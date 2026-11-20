<script setup lang="ts">
import { IconUpload, IconRefresh, IconCheck, IconX, IconArrowBackUp, IconLink } from '@tabler/icons-vue'
import {
  BANK_FIELDS, mappingError, transactionStatus, importStatus, matchReasonLabel, scoreSeverity, allocationPreview,
  formatMoney, formatDate, formatDateTime, errorMessage, type BankTransaction, type Invoice, type Suggestion,
} from '../../composables/useBilling/internal/billing'

/*
 * Billing.Reconciliation — conciliación de pagos: import a bank statement (CSV/XLSX) choosing its columns
 * (preview + suggested mapping), the import runs on the queue and applies the conclusive movements alone;
 * the rest show suggestions (score and reasons) to apply with one click, or are matched by hand (client +
 * open invoices in order: partial payments, several invoices, the rest as client credit). Matches can be
 * undone; movements that are not payments are discarded. Importing the same statement never duplicates.
 * Backend: {endpoint}/reconciliation/* (preview, imports, transactions, open-invoices, match, unmatch, ignore,
 * restore, rematch).
 *
 *   <Billing.Reconciliation :can-edit="isOwner" />
 */
const props = withDefaults(defineProps<{ endpoint?: string; canEdit?: boolean }>(), { endpoint: 'platform/billing', canEdit: true })

const toast = useToast()
const { prompt } = useModal()
const billing = useBillingPlatform({ base: props.endpoint })

// ── Import wizard ────────────────────────────────────────────────────────
const wizard = reactive({
  open: false, file: null as File | null, loading: false, headerRow: null as number | null,
  headers: [] as string[], rows: [] as string[][], mapping: {} as Record<string, string>, bank: '',
})
function openWizard() {
  Object.assign(wizard, { open: true, file: null, loading: false, headerRow: null, headers: [], rows: [], mapping: {}, bank: '' })
}
async function pick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  wizard.file = file
  await loadPreview()
}
async function loadPreview() {
  if (!wizard.file) return
  wizard.loading = true
  try {
    const res = await billing.preview(wizard.file, wizard.headerRow)
    wizard.headerRow = res.header_row
    wizard.headers = res.headers ?? []
    wizard.rows = res.rows ?? []
    const last = res.last_mapping ?? {}
    const fits = Object.values(last).every((h: any) => wizard.headers.includes(h))
    wizard.mapping = { ...(Object.keys(last).length && fits ? last : res.mapping) }
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo leer el archivo.'))
  } finally {
    wizard.loading = false
  }
}
const wizardError = computed(() => wizard.file ? mappingError(wizard.mapping) : 'Elige el archivo de la cartola.')
async function submitImport() {
  if (wizardError.value || !wizard.file) { toast.error(wizardError.value ?? ''); return }
  try {
    const res = await billing.importStatement.mutateAsync({ file: wizard.file, mapping: wizard.mapping, bank: wizard.bank, headerRow: wizard.headerRow })
    wizard.open = false
    toast.success(res?.duplicate ? 'Esta cartola ya estaba importada: no se duplicó nada.' : 'Cartola en proceso. Los movimientos claros se concilian solos.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo importar la cartola.'))
  }
}

// ── Movements ────────────────────────────────────────────────────────────
const filters = reactive({ status: 'open', import_id: '', page: 1 })
const query = billing.transactions(computed(() => ({ ...filters })))
const rows = computed<BankTransaction[]>(() => (query.data.value as any)?.data ?? [])
const meta = computed(() => (query.data.value as any)?.meta ?? { total: 0, page: 1, last_page: 1 })
const summary = computed(() => (query.data.value as any)?.summary ?? { open: 0, open_amount: 0 })
const importsList = computed<any[]>(() => (billing.imports.data.value as any[] | undefined) ?? [])
watch(() => [filters.status, filters.import_id], () => { filters.page = 1 })
// Refresh the movements when a running import finishes.
watch(() => importsList.value.map(i => i.status).join(), () => query.refetch())

async function applySuggestion(t: BankTransaction, s: Suggestion) {
  await doMatch(t, s.client_id, s.invoice_ids)
}
async function doMatch(t: BankTransaction, clientId: string, invoiceIds: string[]) {
  try {
    await billing.match.mutateAsync({ id: t.id, clientId, invoiceIds })
    manual.open = false
    toast.success('Movimiento conciliado.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo conciliar.'))
  }
}
async function unmatch(t: BankTransaction) {
  const reason = await prompt({ title: 'Deshacer conciliación', message: 'Se elimina el pago y las facturas vuelven a quedar pendientes. Indica el motivo.', required: true, confirmText: 'Deshacer' })
  if (!reason) return
  try {
    await billing.unmatch.mutateAsync({ id: t.id, reason })
    toast.success('Conciliación deshecha.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo deshacer.'))
  }
}
async function ignore(t: BankTransaction) {
  const reason = await prompt({ title: 'Descartar movimiento', message: 'Para abonos que no son pagos de clientes (intereses, traspasos).', placeholder: 'Motivo (opcional)', confirmText: 'Descartar' })
  if (reason === null) return
  try {
    await billing.ignore.mutateAsync({ id: t.id, reason })
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo descartar.'))
  }
}
async function restore(t: BankTransaction) {
  try { await billing.restore.mutateAsync(t.id) } catch (e: any) { toast.error(errorMessage(e, 'No se pudo restaurar.')) }
}
async function rematch() {
  try {
    const res = await billing.rematch.mutateAsync(null)
    toast.success(`Revisado: ${res.matched} conciliados, ${res.suggested} con sugerencia.`)
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo revisar.'))
  }
}

// ── Manual match ─────────────────────────────────────────────────────────
const manual = reactive({ open: false, tx: null as BankTransaction | null, search: '', invoices: [] as Invoice[], selected: [] as string[], loading: false })
const manualClient = computed(() => {
  const first = manual.invoices.find(i => i.id === manual.selected[0])
  return first?.client_id ?? null
})
const preview = computed(() => manual.tx ? allocationPreview(manual.tx.amount, manual.invoices, manual.selected) : { rows: [], credit: 0 })
const appliedTo = (id: string): number | null => preview.value.rows.find(r => r.id === id)?.applied ?? null
async function openManual(t: BankTransaction) {
  Object.assign(manual, { open: true, tx: t, search: t.suggestions[0]?.client_name ?? '', invoices: [], selected: [] })
  await searchInvoices()
}
async function searchInvoices() {
  manual.loading = true
  try {
    const suggested = manual.tx?.suggestions[0]
    manual.invoices = await billing.openInvoices(manual.search ? { q: manual.search } : { client_id: suggested?.client_id ?? null })
  } catch {
    manual.invoices = []
  } finally {
    manual.loading = false
  }
}
function toggle(i: Invoice) {
  if (manual.selected.includes(i.id)) {
    manual.selected = manual.selected.filter(id => id !== i.id)
  } else if (!manualClient.value || i.client_id === manualClient.value) {
    manual.selected = [...manual.selected, i.id]
  } else {
    toast.error('Un pago se aplica a facturas de un solo cliente.')
  }
}
async function submitManual() {
  if (!manual.tx || !manualClient.value) { toast.error('Elige al menos una factura.'); return }
  await doMatch(manual.tx, manualClient.value, manual.selected)
}

const inputClass = 'h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-3 text-sm">
      <label class="space-y-1"><span class="block text-xs text-muted-foreground">Movimientos</span>
        <select v-model="filters.status" :class="inputClass">
          <option value="open">Pendientes</option>
          <option value="suggested">Con sugerencia</option>
          <option value="unmatched">Sin emparejar</option>
          <option value="matched">Conciliados</option>
          <option value="ignored">Descartados</option>
          <option value="">Todos</option>
        </select>
      </label>
      <label class="space-y-1"><span class="block text-xs text-muted-foreground">Cartola</span>
        <select v-model="filters.import_id" :class="inputClass">
          <option value="">Todas</option>
          <option v-for="i in importsList" :key="i.id" :value="i.id">{{ i.file_name }} · {{ formatDateTime(i.created_at) }}</option>
        </select>
      </label>
      <span class="flex-1 text-xs text-muted-foreground">{{ summary.open }} pendientes · {{ formatMoney(summary.open_amount) }}</span>
      <App.Button v-if="canEdit" text="Revisar de nuevo" size="sm" outline :icon="IconRefresh" :loading="billing.rematch.isPending.value" @click="rematch" />
      <App.Button v-if="canEdit" text="Importar cartola" size="sm" severity="primary" :icon="IconUpload" @click="openWizard" />
    </div>

    <div v-if="importsList.some(i => i.status === 'pending' || i.status === 'processing' || i.status === 'failed')" class="space-y-1">
      <p v-for="i in importsList.filter(x => x.status !== 'done').slice(0, 3)" :key="i.id" class="text-xs">
        <App.Tag :text="importStatus(i.status).label" :severity="importStatus(i.status).severity" size="xs" /> {{ i.file_name }}
        <span v-if="i.error" class="text-danger"> · {{ i.error }}</span>
      </p>
    </div>

    <div class="bg-card border border-card-line rounded-card overflow-x-auto">
      <div v-if="query.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="!rows.length" class="p-8 text-center text-sm text-muted-foreground">No hay movimientos {{ filters.status === 'open' ? 'pendientes' : '' }}.</div>
      <table v-else class="w-full text-sm">
        <thead class="text-xs uppercase text-muted-foreground">
          <tr class="border-b border-card-line">
            <th class="text-left font-medium px-4 py-2">Fecha</th>
            <th class="text-left font-medium px-4 py-2">Movimiento</th>
            <th class="text-right font-medium px-4 py-2">Monto</th>
            <th class="text-left font-medium px-4 py-2">Conciliación</th>
            <th class="px-4 py-2" />
          </tr>
        </thead>
        <tbody class="divide-y divide-card-line">
          <tr v-for="t in rows" :key="t.id" class="align-top">
            <td class="px-4 py-2 whitespace-nowrap text-muted-foreground">{{ formatDate(t.posted_at) }}</td>
            <td class="px-4 py-2">
              <p class="text-foreground">{{ t.description || '—' }}</p>
              <p class="text-xs text-muted-foreground">{{ [t.reference, t.tax_id, t.counterpart_name].filter(Boolean).join(' · ') }}</p>
            </td>
            <td class="px-4 py-2 text-right font-medium whitespace-nowrap">{{ formatMoney(t.amount) }}</td>
            <td class="px-4 py-2">
              <App.Tag :text="transactionStatus(t.status).label" :severity="transactionStatus(t.status).severity" size="xs" />
              <p v-if="t.status === 'matched'" class="text-xs text-muted-foreground mt-1">{{ t.client_name }} · {{ t.matched_by === 'auto' ? 'automática' : 'manual' }} · {{ formatDateTime(t.matched_at) }}</p>
              <p v-if="t.status === 'ignored' && t.ignore_reason" class="text-xs text-muted-foreground mt-1">{{ t.ignore_reason }}</p>
              <ul v-if="t.status === 'suggested'" class="mt-1 space-y-1">
                <li v-for="(s, idx) in t.suggestions" :key="idx" class="flex flex-wrap items-center gap-1 text-xs">
                  <App.Tag :text="`${s.score}`" :severity="scoreSeverity(s.score)" size="xs" />
                  <span class="text-foreground">{{ s.client_name }}</span>
                  <span class="text-muted-foreground">{{ s.invoices.join(', ') }} · {{ s.reasons.map(matchReasonLabel).join(', ') }}</span>
                  <button v-if="canEdit" type="button" class="text-primary hover:underline" @click="applySuggestion(t, s)">Aplicar</button>
                </li>
              </ul>
            </td>
            <td class="px-4 py-2">
              <div v-if="canEdit" class="flex justify-end gap-1">
                <App.Button v-if="t.status === 'unmatched' || t.status === 'suggested'" text="Emparejar" size="xs" :icon="IconLink" @click="openManual(t)" />
                <App.Button v-if="t.status === 'unmatched' || t.status === 'suggested'" text="Descartar" size="xs" outline :icon="IconX" @click="ignore(t)" />
                <App.Button v-if="t.status === 'matched'" text="Deshacer" size="xs" outline :icon="IconArrowBackUp" @click="unmatch(t)" />
                <App.Button v-if="t.status === 'ignored'" text="Restaurar" size="xs" outline @click="restore(t)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="meta.last_page > 1" class="flex items-center justify-end gap-2 text-sm">
      <App.Button text="Anterior" size="xs" :disabled="filters.page <= 1" @click="filters.page--" />
      <span class="text-muted-foreground">Página {{ meta.page }} de {{ meta.last_page }}</span>
      <App.Button text="Siguiente" size="xs" :disabled="filters.page >= meta.last_page" @click="filters.page++" />
    </div>

    <!-- Import wizard -->
    <Modal v-model="wizard.open" title="Importar cartola" size="3xl" show-footer>
      <div class="space-y-4 text-sm">
        <p class="text-muted-foreground">Exporta la cartola del banco en Excel (.xlsx) o CSV. Solo se toman los abonos; importar la misma cartola dos veces no duplica movimientos.</p>
        <div class="flex flex-wrap items-end gap-3">
          <label class="space-y-1"><span class="block font-medium">Archivo</span><input type="file" accept=".csv,.txt,.xlsx" class="text-sm" @change="pick" /></label>
          <label class="space-y-1"><span class="block font-medium">Banco (opcional)</span><input v-model="wizard.bank" :class="inputClass" maxlength="80" /></label>
          <label v-if="wizard.headers.length" class="space-y-1"><span class="block font-medium">Fila de encabezados</span>
            <input v-model.number="wizard.headerRow" type="number" min="1" :class="inputClass" class="w-24" @change="loadPreview" />
          </label>
        </div>
        <p v-if="wizard.loading" class="text-muted-foreground">Leyendo el archivo…</p>
        <template v-else-if="wizard.headers.length">
          <div class="grid gap-3 sm:grid-cols-2">
            <label v-for="f in BANK_FIELDS" :key="f.key" class="block space-y-1">
              <span class="font-medium">{{ f.label }} <span v-if="f.hint" class="text-xs text-muted-foreground font-normal">({{ f.hint }})</span></span>
              <select v-model="wizard.mapping[f.key]" :class="inputClass" class="w-full">
                <option value="">—</option>
                <option v-for="h in wizard.headers" :key="h" :value="h">{{ h }}</option>
              </select>
            </label>
          </div>
          <div class="overflow-x-auto border border-card-line rounded-control">
            <table class="w-full text-xs">
              <thead><tr class="bg-muted/40"><th v-for="h in wizard.headers" :key="h" class="text-left px-2 py-1 font-medium">{{ h }}</th></tr></thead>
              <tbody class="divide-y divide-card-line"><tr v-for="(r, idx) in wizard.rows" :key="idx"><td v-for="(c, j) in r.slice(0, wizard.headers.length)" :key="j" class="px-2 py-1 whitespace-nowrap">{{ c }}</td></tr></tbody>
            </table>
          </div>
          <p v-if="wizardError" class="text-warning">{{ wizardError }}</p>
        </template>
      </div>
      <template #footer>
        <App.Button text="Cancelar" size="sm" @click="wizard.open = false" />
        <App.Button text="Importar" severity="primary" size="sm" :disabled="!!wizardError" :loading="billing.importStatement.isPending.value" @click="submitImport" />
      </template>
    </Modal>

    <!-- Manual match -->
    <Modal v-model="manual.open" title="Emparejar movimiento" size="2xl" show-footer>
      <div v-if="manual.tx" class="space-y-3 text-sm">
        <p>{{ formatDate(manual.tx.posted_at) }} · <span class="font-medium">{{ formatMoney(manual.tx.amount) }}</span> · {{ manual.tx.description }}</p>
        <form class="flex gap-2" @submit.prevent="searchInvoices">
          <input v-model="manual.search" :class="inputClass" class="flex-1" placeholder="Cliente o RUT" />
          <App.Button text="Buscar" size="sm" :loading="manual.loading" @click="searchInvoices" />
        </form>
        <p class="text-xs text-muted-foreground">Elige las facturas en el orden en que se pagan. Si el monto no alcanza, la última queda con pago parcial; si sobra, queda como saldo a favor del cliente.</p>
        <div class="border border-card-line rounded-control divide-y divide-card-line max-h-72 overflow-y-auto">
          <p v-if="!manual.invoices.length" class="p-4 text-center text-muted-foreground">Sin facturas abiertas.</p>
          <label v-for="i in manual.invoices" :key="i.id" class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
            <input type="checkbox" class="rounded" :checked="manual.selected.includes(i.id)" @change="toggle(i)" />
            <span class="flex-1">{{ i.display_number }} · {{ i.client_name }}<span class="text-xs text-muted-foreground"> · vence {{ formatDateTime(i.due_at) }}</span></span>
            <span>{{ formatMoney(i.balance, i.currency) }}</span>
            <span v-if="appliedTo(i.id) !== null" class="text-xs text-success w-28 text-right">aplica {{ formatMoney(appliedTo(i.id)) }}</span>
          </label>
        </div>
        <p v-if="manual.selected.length && preview.credit > 0" class="text-xs text-info">Quedan {{ formatMoney(preview.credit) }} como saldo a favor del cliente.</p>
      </div>
      <template #footer>
        <App.Button text="Cancelar" size="sm" @click="manual.open = false" />
        <App.Button text="Conciliar" severity="primary" size="sm" :icon="IconCheck" :disabled="!manual.selected.length" :loading="billing.match.isPending.value" @click="submitManual" />
      </template>
    </Modal>
  </div>
</template>
