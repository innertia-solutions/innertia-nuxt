<script setup lang="ts">
import { IconFileInvoice, IconSend, IconDownload, IconCash, IconCheck, IconBan, IconRepeat, IconReceiptRefund, IconPercentage } from '@tabler/icons-vue'
import {
  formatMoney, invoiceStatus, periodLabel, formatDate, formatDateTime, eventLabel, paymentMethodLabel, parseMoney, errorMessage,
  reissuePayload, BILLING_FIELDS, INVOICE_STATUS_OPTIONS, type Invoice, type CorrectionLine,
} from '../../composables/useBilling/internal/billing'

/*
 * Billing.Invoices — platform invoices: filters, detail (statements and lines per space, bitácora,
 * payments), Emitir (folio optional, email to the billing contact), Reenviar, PDF and Registrar pago
 * (transfer registered by hand; the remainder stays as client credit). Collections: Anular (reason), Refacturar
 * (void + replacement with corrected billing data and correction lines; payments move over), Nota de crédito
 * and Condonar interés por mora; the detail shows credit notes, late fee ranges and the void/reissue trail.
 * Backend: \Innertia\Billing\Routes::platform() + platformWrite().
 *
 *   <Billing.Invoices :clients="[{ value: id, label: name }]" />
 *   <Billing.Invoices :client-id="client.id" />            (inside a client detail)
 *   <Billing.Invoices space-key="rancagua" />              (inside a space detail)
 */
const props = withDefaults(defineProps<{
  endpoint?: string
  clientId?: string | null
  spaceKey?: string | null
  clients?: { value: string; label: string }[]
  canEdit?: boolean
}>(), { endpoint: 'platform/billing', clientId: null, spaceKey: null, clients: () => [], canEdit: true })

const toast = useToast()
const billing = useBillingPlatform({ base: props.endpoint })
const savePdf = useBillingPdf()

const filters = reactive({ status: '', client_id: props.clientId ?? '', tenant_key: props.spaceKey ?? '', page: 1 })
const filterRef = computed(() => ({ ...filters }))
const query = billing.invoices(filterRef)
const rows = computed<Invoice[]>(() => (query.data.value as any)?.data ?? [])
const meta = computed(() => (query.data.value as any)?.meta ?? { total: 0, page: 1, last_page: 1 })
watch(() => [filters.status, filters.client_id], () => { filters.page = 1 })

// ── Detail ────────────────────────────────────────────────────────────────
const detail = ref<Invoice | null>(null)
const loadingDetail = ref(false)
async function openDetail(i: Invoice) {
  detail.value = i
  loadingDetail.value = true
  try {
    detail.value = await billing.invoice(i.id)
  } catch {
    toast.error('No se pudo cargar la factura.')
  } finally {
    loadingDetail.value = false
  }
}
const showDetail = computed({ get: () => detail.value !== null, set: (v) => { if (!v) detail.value = null } })

// ── Issue ─────────────────────────────────────────────────────────────────
const issueForm = reactive({ open: false, invoice: null as Invoice | null, folio: '', send: true })
function openIssue(i: Invoice) {
  Object.assign(issueForm, { open: true, invoice: i, folio: i.folio ?? '', send: true })
}
async function submitIssue() {
  if (!issueForm.invoice) return
  try {
    const res = await billing.issue.mutateAsync({ id: issueForm.invoice.id, body: { folio: issueForm.folio || null, send: issueForm.send } })
    issueForm.open = false
    if (detail.value?.id === res.id) detail.value = res
    toast.success(`Factura ${res.display_number} emitida${issueForm.send ? ' y enviada' : ''}.`)
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo emitir la factura.'))
  }
}

async function resend(i: Invoice) {
  try {
    const res = await billing.resend.mutateAsync(i.id)
    res?.sent ? toast.success('Factura reenviada.') : toast.error('El cliente no tiene correo de facturación.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo reenviar la factura.'))
  }
}

async function pdf(i: Invoice) {
  try {
    await savePdf(`${billing.base}/invoices/${i.id}/pdf`, `factura-${i.display_number ?? i.id}.pdf`)
  } catch {
    toast.error('No se pudo descargar el PDF.')
  }
}

// ── Payment ───────────────────────────────────────────────────────────────
const payForm = reactive({ open: false, invoice: null as Invoice | null, amount: '', reference: '', received_at: '', method: 'transfer' })
function openPay(i: Invoice) {
  Object.assign(payForm, { open: true, invoice: i, amount: String(i.balance), reference: '', received_at: new Date().toISOString().slice(0, 10), method: 'transfer' })
}
async function submitPay() {
  const i = payForm.invoice
  const amount = parseMoney(payForm.amount)
  if (!i || !amount || Number.isNaN(amount) || amount <= 0) { toast.error('Ingresa un monto válido.'); return }
  try {
    await billing.registerPayment.mutateAsync({
      client_id: i.client_id, amount, method: payForm.method, reference: payForm.reference || null,
      received_at: payForm.received_at || null, invoice_id: i.id,
    })
    payForm.open = false
    if (detail.value?.id === i.id) await openDetail(i)
    toast.success(amount > i.balance ? 'Pago registrado. El excedente quedó como saldo a favor.' : 'Pago registrado.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo registrar el pago.'))
  }
}

// ── Collections: void, reissue, credit note, late fee waiver ─────────────
const { prompt } = useModal()
async function reloadDetail(i: Invoice) {
  if (detail.value?.id === i.id) await openDetail(i)
}
async function voidInvoice(i: Invoice) {
  const reason = await prompt({
    title: `Anular factura ${i.display_number}`,
    message: 'La factura queda anulada (no se borra). Lo pagado pasa a saldo a favor del cliente. Para corregirla usa Refacturar.',
    required: true, confirmText: 'Anular',
  })
  if (!reason) return
  try {
    detail.value = await billing.voidInvoice.mutateAsync({ id: i.id, reason })
    toast.success('Factura anulada.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo anular la factura.'))
  }
}

const reissueForm = reactive({
  open: false, invoice: null as Invoice | null, reason: '', billing_data: {} as Record<string, string>, original: {} as Record<string, string | null>,
  lines: [] as CorrectionLine[], due_at: '', send: true,
})
function openReissue(i: Invoice) {
  const data = Object.fromEntries(BILLING_FIELDS.map(f => [f.key, (i.billing_data?.[f.key] ?? '') as string]))
  Object.assign(reissueForm, { open: true, invoice: i, reason: '', billing_data: { ...data }, original: { ...data }, lines: [], due_at: '', send: true })
}
async function submitReissue() {
  const i = reissueForm.invoice
  if (!i) return
  const { payload, error } = reissuePayload(reissueForm)
  if (error) { toast.error(error); return }
  try {
    const res = await billing.reissue.mutateAsync({ id: i.id, body: payload! })
    reissueForm.open = false
    detail.value = res
    toast.success(`Factura ${i.display_number} anulada y reemplazada por ${res.display_number}.`)
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo refacturar.'))
  }
}

async function waive(i: Invoice) {
  const reason = await prompt({ title: 'Condonar interés por mora', message: `Factura ${i.display_number}: deja de generar interés y se devuelve el ya cobrado.`, required: true, confirmText: 'Condonar' })
  if (!reason) return
  try {
    const res = await billing.waiveLateFees.mutateAsync({ id: i.id, reason })
    toast.success(`Interés condonado: ${formatMoney(res.removed + res.credited)}.`)
    await reloadDetail(i)
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo condonar el interés.'))
  }
}

const creditNote = reactive({ open: false, invoice: null as Invoice | null })
const isIssued = (i: Invoice) => ['issued', 'overdue', 'paid'].includes(i.status)
const hasLateFees = (i: Invoice) => (i.late_fees ?? []).some(f => !f.waived_at) || i.status === 'overdue'

const inputClass = 'w-full h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
const isOpen = (i: Invoice) => i.status === 'issued' || i.status === 'overdue'
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-3">
      <label class="space-y-1">
        <span class="text-xs text-muted-foreground">Estado</span>
        <select v-model="filters.status" :class="inputClass">
          <option value="">Todos</option>
          <option v-for="o in INVOICE_STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <label v-if="!clientId && clients.length" class="space-y-1">
        <span class="text-xs text-muted-foreground">Cliente</span>
        <select v-model="filters.client_id" :class="inputClass">
          <option value="">Todos</option>
          <option v-for="c in clients" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </label>
      <span class="flex-1" />
      <span class="text-xs text-muted-foreground">{{ meta.total }} facturas</span>
    </div>

    <div class="bg-card border border-card-line rounded-card overflow-x-auto">
      <div v-if="query.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="query.isError.value" class="p-8 text-center text-sm text-muted-foreground">
        No se pudieron cargar las facturas.
        <button type="button" class="text-primary hover:underline" @click="query.refetch()">Reintentar</button>
      </div>
      <div v-else-if="!rows.length" class="p-8 text-center text-sm text-muted-foreground">
        <IconFileInvoice class="size-6 mx-auto mb-2" :stroke-width="1.5" />
        No hay facturas. Se generan en borrador al cerrar cada período.
      </div>
      <table v-else class="w-full text-sm">
        <thead class="text-xs uppercase text-muted-foreground">
          <tr class="border-b border-card-line">
            <th class="text-left font-medium px-4 py-2">Factura</th>
            <th class="text-left font-medium px-4 py-2">Cliente / espacio</th>
            <th class="text-left font-medium px-4 py-2">Período</th>
            <th class="text-right font-medium px-4 py-2">Total</th>
            <th class="text-right font-medium px-4 py-2">Saldo</th>
            <th class="text-left font-medium px-4 py-2">Vence</th>
            <th class="px-4 py-2" />
          </tr>
        </thead>
        <tbody class="divide-y divide-card-line">
          <tr v-for="i in rows" :key="i.id" class="hover:bg-muted/40">
            <td class="px-4 py-2">
              <button type="button" class="font-medium text-foreground hover:underline" @click="openDetail(i)">{{ i.display_number ?? 'Borrador' }}</button>
              <App.Tag :text="invoiceStatus(i.status).label" :severity="invoiceStatus(i.status).severity" size="xs" class="ml-2" />
              <p v-if="i.folio" class="text-xs text-muted-foreground">Folio {{ i.folio }}</p>
            </td>
            <td class="px-4 py-2">
              <p class="text-foreground">{{ i.client_name }}</p>
              <p class="text-xs text-muted-foreground">{{ i.consolidated ? 'Consolidada' : i.tenant_name }}</p>
            </td>
            <td class="px-4 py-2 text-muted-foreground">{{ periodLabel(i.period_start, i.period_end) }}</td>
            <td class="px-4 py-2 text-right">{{ formatMoney(i.total, i.currency) }}</td>
            <td class="px-4 py-2 text-right" :class="i.status === 'overdue' ? 'text-danger font-medium' : ''">{{ formatMoney(i.balance, i.currency) }}</td>
            <td class="px-4 py-2 text-muted-foreground">{{ formatDateTime(i.due_at) }}</td>
            <td class="px-4 py-2">
              <div class="flex justify-end gap-1">
                <App.Button v-if="canEdit && i.status === 'draft'" text="Emitir" size="xs" severity="primary" :icon="IconCheck" @click="openIssue(i)" />
                <App.Button v-if="canEdit && isOpen(i)" text="Registrar pago" size="xs" :icon="IconCash" @click="openPay(i)" />
                <App.Button text="PDF" size="xs" outline :icon="IconDownload" @click="pdf(i)" />
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

    <!-- Detail -->
    <Modal v-model="showDetail" :title="detail ? `Factura ${detail.display_number ?? '(borrador)'}` : ''" size="3xl" show-footer>
      <div v-if="detail" class="space-y-4 text-sm">
        <div class="flex flex-wrap gap-2 items-center">
          <App.Tag :text="invoiceStatus(detail.status).label" :severity="invoiceStatus(detail.status).severity" size="xs" />
          <span class="text-muted-foreground">{{ detail.client_name }} · {{ detail.consolidated ? 'Factura consolidada' : detail.tenant_name }} · {{ paymentMethodLabel(detail.payment_method) }}</span>
        </div>
        <div class="grid gap-2 sm:grid-cols-4">
          <div><p class="text-xs text-muted-foreground">Subtotal</p><p>{{ formatMoney(detail.subtotal, detail.currency) }}</p></div>
          <div><p class="text-xs text-muted-foreground">IVA</p><p>{{ formatMoney(detail.tax, detail.currency) }}</p></div>
          <div><p class="text-xs text-muted-foreground">Total</p><p class="font-medium">{{ formatMoney(detail.total, detail.currency) }}</p></div>
          <div><p class="text-xs text-muted-foreground">Saldo</p><p class="font-medium">{{ formatMoney(detail.balance, detail.currency) }}</p></div>
        </div>
        <p v-if="detail.payment_link" class="text-xs">Enlace de pago: <a :href="detail.payment_link" target="_blank" rel="noopener" class="text-primary hover:underline break-all">{{ detail.payment_link }}</a></p>

        <p v-if="detail.status === 'void'" class="text-xs text-danger">Anulada {{ formatDateTime(detail.voided_at) }}<template v-if="detail.void_reason"> · {{ detail.void_reason }}</template></p>
        <p v-if="detail.replaces_invoice_id" class="text-xs text-muted-foreground">Reemplaza a una factura anulada (refacturación).</p>
        <p v-if="detail.late_fees_waived_at" class="text-xs text-muted-foreground">Interés por mora condonado {{ formatDateTime(detail.late_fees_waived_at) }}.</p>

        <div v-if="loadingDetail" class="text-muted-foreground">Cargando detalle…</div>
        <template v-else>
          <div v-for="s in detail.statements ?? []" :key="s.id" class="border border-card-line rounded-control">
            <p class="px-3 py-2 bg-muted/40 text-xs font-medium">{{ s.tenant_name ?? s.tenant_id }} · {{ periodLabel(s.period_start, s.period_end) }}</p>
            <table class="w-full">
              <tbody class="divide-y divide-card-line">
                <tr v-for="(l, idx) in s.lines" :key="idx">
                  <td class="px-3 py-1.5">{{ l.description }}</td>
                  <td class="px-3 py-1.5 text-right text-muted-foreground">{{ l.quantity }}</td>
                  <td class="px-3 py-1.5 text-right text-muted-foreground">{{ l.unit_price ? formatMoney(l.unit_price, detail.currency) : '' }}</td>
                  <td class="px-3 py-1.5 text-right">{{ formatMoney(l.amount, detail.currency) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="detail.credit_notes?.length">
            <p class="text-xs font-medium text-muted-foreground mb-1">Notas de crédito</p>
            <ul class="space-y-1 text-xs">
              <li v-for="n in detail.credit_notes" :key="n.id">{{ n.display_number }} · {{ formatMoney(n.amount ?? 0, detail.currency) }} · {{ n.reason }}</li>
            </ul>
          </div>
          <div v-if="detail.late_fees?.length">
            <p class="text-xs font-medium text-muted-foreground mb-1">Interés por mora generado</p>
            <ul class="space-y-1 text-xs">
              <li v-for="(f, idx) in detail.late_fees" :key="idx" :class="f.waived_at ? 'line-through text-muted-foreground' : ''">
                {{ formatDate(f.from) }} al {{ formatDate(f.to) }} · {{ f.days }} días sobre {{ formatMoney(f.base, detail.currency) }} · {{ formatMoney(f.amount, detail.currency) }}
              </li>
            </ul>
          </div>

          <div v-if="detail.events?.length">
            <p class="text-xs font-medium text-muted-foreground mb-1">Bitácora</p>
            <ul class="space-y-1">
              <li v-for="(e, idx) in detail.events" :key="idx" class="text-xs text-muted-foreground">
                {{ formatDateTime(e.created_at) }} · {{ eventLabel(e.event) }}<template v-if="e.data?.amount"> · {{ formatMoney(e.data.amount, detail.currency) }}</template><template v-if="e.data?.reason"> · {{ e.data.reason }}</template>
                <template v-if="e.event === 'reissued' && e.data?.totals"> · total {{ formatMoney(e.data.totals.before.total, detail.currency) }} → {{ formatMoney(e.data.totals.after.total, detail.currency) }}</template>
                <template v-if="e.event === 'reissued' && e.data?.billing_data && Object.keys(e.data.billing_data).length"> · cambió {{ Object.keys(e.data.billing_data).join(', ') }}</template>
              </li>
            </ul>
          </div>
        </template>
      </div>
      <template #footer>
        <template v-if="detail">
          <App.Button v-if="canEdit && detail.status === 'draft'" text="Emitir" size="sm" severity="primary" :icon="IconCheck" @click="openIssue(detail)" />
          <App.Button v-if="canEdit && detail.status !== 'draft' && detail.status !== 'void'" text="Reenviar" size="sm" :icon="IconSend" :loading="billing.resend.isPending.value" @click="resend(detail)" />
          <App.Button v-if="canEdit && isOpen(detail)" text="Registrar pago" size="sm" :icon="IconCash" @click="openPay(detail)" />
          <App.Button v-if="canEdit && isOpen(detail)" text="Nota de crédito" size="sm" :icon="IconReceiptRefund" @click="creditNote.invoice = detail; creditNote.open = true" />
          <App.Button v-if="canEdit && isIssued(detail) && hasLateFees(detail) && !detail.late_fees_waived_at" text="Condonar interés" size="sm" :icon="IconPercentage" :loading="billing.waiveLateFees.isPending.value" @click="waive(detail)" />
          <App.Button v-if="canEdit && isIssued(detail)" text="Refacturar" size="sm" :icon="IconRepeat" @click="openReissue(detail)" />
          <App.Button v-if="canEdit && isIssued(detail)" text="Anular" size="sm" outline :icon="IconBan" :loading="billing.voidInvoice.isPending.value" @click="voidInvoice(detail)" />
          <App.Button text="PDF" size="sm" outline :icon="IconDownload" @click="pdf(detail)" />
        </template>
        <App.Button text="Cerrar" size="sm" @click="detail = null" />
      </template>
    </Modal>

    <!-- Issue -->
    <Modal v-model="issueForm.open" title="Emitir factura" size="md" show-footer>
      <div v-if="issueForm.invoice" class="space-y-3 text-sm">
        <p>Se asigna el número correlativo, vence según el plazo del cliente y se envía al correo de facturación con el PDF adjunto. Total {{ formatMoney(issueForm.invoice.total, issueForm.invoice.currency) }}.</p>
        <label class="block space-y-1"><span class="font-medium">Folio SII (opcional)</span><input v-model="issueForm.folio" :class="inputClass" maxlength="40" /></label>
        <label class="flex items-center gap-2"><input v-model="issueForm.send" type="checkbox" class="rounded" /> Enviar por correo y avisar a los administradores del espacio</label>
      </div>
      <template #footer>
        <App.Button text="Cancelar" size="sm" @click="issueForm.open = false" />
        <App.Button text="Emitir" severity="primary" size="sm" :loading="billing.issue.isPending.value" @click="submitIssue" />
      </template>
    </Modal>

    <!-- Reissue -->
    <Modal v-model="reissueForm.open" :title="reissueForm.invoice ? `Refacturar ${reissueForm.invoice.display_number}` : ''" size="2xl" show-footer>
      <div v-if="reissueForm.invoice" class="space-y-3 text-sm">
        <p class="text-muted-foreground">La factura se anula y se emite otra con número nuevo. Los pagos aplicados pasan a la nueva y todo queda en la bitácora.</p>
        <label class="block space-y-1"><span class="font-medium">Motivo (obligatorio)</span><input v-model="reissueForm.reason" :class="inputClass" maxlength="250" /></label>
        <p class="font-medium">Datos de facturación</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label v-for="f in BILLING_FIELDS" :key="f.key" class="block space-y-1"><span class="text-xs text-muted-foreground">{{ f.label }}</span>
            <input v-model="reissueForm.billing_data[f.key]" :class="inputClass" maxlength="250" />
          </label>
        </div>
        <div class="space-y-2">
          <div class="flex items-center"><p class="font-medium flex-1">Correcciones (monto neto, negativo para rebajar)</p>
            <App.Button text="Agregar línea" size="xs" @click="reissueForm.lines.push({ description: '', amount: '' })" />
          </div>
          <div v-for="(l, idx) in reissueForm.lines" :key="idx" class="flex gap-2">
            <input v-model="l.description" :class="inputClass" placeholder="Descripción" maxlength="200" />
            <input v-model="l.amount" :class="inputClass" class="max-w-40" inputmode="numeric" placeholder="-10000" />
            <App.Button text="Quitar" size="xs" outline @click="reissueForm.lines.splice(idx, 1)" />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block space-y-1"><span class="font-medium">Nuevo vencimiento (opcional)</span><input v-model="reissueForm.due_at" type="date" :class="inputClass" />
            <span class="text-xs text-muted-foreground">Vacío = mantiene el vencimiento original.</span>
          </label>
          <label class="flex items-center gap-2 self-center"><input v-model="reissueForm.send" type="checkbox" class="rounded" /> Enviar la nueva factura por correo</label>
        </div>
      </div>
      <template #footer>
        <App.Button text="Cancelar" size="sm" @click="reissueForm.open = false" />
        <App.Button text="Anular y reemitir" severity="primary" size="sm" :loading="billing.reissue.isPending.value" @click="submitReissue" />
      </template>
    </Modal>

    <Billing.CreditNoteForm v-if="creditNote.invoice" v-model="creditNote.open" :endpoint="endpoint" :client-id="creditNote.invoice.client_id" :invoice="creditNote.invoice"
      @created="detail && openDetail(detail)" />

    <!-- Payment -->
    <Modal v-model="payForm.open" title="Registrar pago" size="md" show-footer>
      <div v-if="payForm.invoice" class="space-y-3 text-sm">
        <p class="text-muted-foreground">Factura {{ payForm.invoice.display_number }} · saldo {{ formatMoney(payForm.invoice.balance, payForm.invoice.currency) }}</p>
        <label class="block space-y-1"><span class="font-medium">Monto ($)</span><input v-model="payForm.amount" inputmode="numeric" :class="inputClass" /></label>
        <label class="block space-y-1"><span class="font-medium">Medio</span>
          <select v-model="payForm.method" :class="inputClass"><option value="transfer">Transferencia</option><option value="manual">Otro (manual)</option></select>
        </label>
        <label class="block space-y-1"><span class="font-medium">Fecha de recepción</span><input v-model="payForm.received_at" type="date" :class="inputClass" /></label>
        <label class="block space-y-1"><span class="font-medium">Referencia</span><input v-model="payForm.reference" :class="inputClass" maxlength="120" placeholder="N° de operación" /></label>
      </div>
      <template #footer>
        <App.Button text="Cancelar" size="sm" @click="payForm.open = false" />
        <App.Button text="Registrar" severity="primary" size="sm" :loading="billing.registerPayment.isPending.value" @click="submitPay" />
      </template>
    </Modal>
  </div>
</template>
