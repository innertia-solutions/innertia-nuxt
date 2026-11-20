<script setup lang="ts">
import { IconFileInvoice, IconSend, IconDownload, IconCash, IconCheck } from '@tabler/icons-vue'
import {
  formatMoney, invoiceStatus, periodLabel, formatDateTime, eventLabel, paymentMethodLabel, parseMoney, errorMessage,
  INVOICE_STATUS_OPTIONS, type Invoice,
} from '../../composables/useBilling/internal/billing'

/*
 * Billing.Invoices — platform invoices: filters, detail (statements and lines per space, bitácora,
 * payments), Emitir (folio optional, email to the billing contact), Reenviar, PDF and Registrar pago
 * (transfer registered by hand; the remainder stays as client credit).
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

          <div v-if="detail.events?.length">
            <p class="text-xs font-medium text-muted-foreground mb-1">Bitácora</p>
            <ul class="space-y-1">
              <li v-for="(e, idx) in detail.events" :key="idx" class="text-xs text-muted-foreground">
                {{ formatDateTime(e.created_at) }} · {{ eventLabel(e.event) }}<template v-if="e.data?.amount"> · {{ formatMoney(e.data.amount, detail.currency) }}</template>
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
