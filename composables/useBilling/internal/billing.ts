/**
 * Pure helpers for the billing screens (no Nuxt/Vue: testable in node).
 * Backend: innertia-laravel \Innertia\Billing\Routes (platform + backoffice).
 * Money arrives as integers in the currency minor unit (CLP = pesos, no decimals).
 */

export type Severity = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'void'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled'

export interface PlanMeter {
  meter: string
  label?: string
  unit?: string | null
  valued_by_cost?: boolean
  included_quantity: number
  unit_price: number
  markup_percent: number | null
}

export interface Plan {
  id: string
  key: string
  name: string
  description?: string | null
  product?: string | null
  currency: string
  interval: 'monthly' | 'annual'
  base_price: number
  included_seats: number
  seat_price: number
  trial_days: number
  tax_rate: number
  limits?: Record<string, any>
  active: boolean
  meters: PlanMeter[]
}

export interface MeterDefinition { key: string; label: string; unit: string; aggregation: 'sum' | 'max'; valued_by_cost: boolean; description?: string }

export interface Subscription {
  id: string
  tenant_id: string
  status: SubscriptionStatus
  status_label: string
  plan: { id: string; key: string; name: string } | null
  pending_plan: { id: string; key: string; name: string } | null
  payment_method: 'automatic' | 'invoice'
  overrides: Record<string, any>
  started_at: string | null
  trial_ends_at: string | null
  current_period_start: string
  current_period_end: string
  suspended_manually: boolean
}

export interface StatementLine { kind: string; description: string; meter: string | null; quantity: number; unit_price: number; amount: number; meta?: any }
export interface Statement { id: string; tenant_id: string; tenant_name?: string | null; invoice_id: string | null; period_start: string; period_end: string; subtotal: number; tax: number; total: number; lines: StatementLine[] }

export interface Invoice {
  id: string
  number: number | null
  display_number: string | null
  client_id: string
  client_name?: string | null
  tenant_id: string | null
  tenant_name?: string | null
  consolidated: boolean
  period_start: string
  period_end: string
  currency: string
  subtotal: number
  tax: number
  total: number
  balance: number
  status: InvoiceStatus
  status_label: string
  payment_method: 'automatic' | 'invoice'
  payment_link: string | null
  folio: string | null
  issued_at: string | null
  due_at: string | null
  paid_at: string | null
  sent_at: string | null
  voided_at?: string | null
  void_reason?: string | null
  replaces_invoice_id?: string | null
  replaced_by_invoice_id?: string | null
  late_fees_waived_at?: string | null
  billing_data?: Record<string, string | null> | null
  late_fees?: LateFee[]
  credit_notes?: Adjustment[]
  space_part?: number
  statements?: Statement[]
  events?: { event: string; user_id: string | null; data: any; created_at: string }[]
  allocations?: { payment_id: string; amount: number; created_at: string }[]
}

export interface UsageEstimate {
  meter: { key: string; label: string; unit: string; valued_by_cost: boolean }
  quantity: number
  cost: number
  included_quantity: number
  unit_price: number
  markup_percent: number | null
  estimated_amount: number
}

/** 152420 → "$ 152.420" (CLP); other currencies in cents → "USD 12,50". */
export function formatMoney(amount: number | null | undefined, currency = 'CLP'): string {
  if (amount === null || amount === undefined) return '—'
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(Math.round(amount))
  if (currency === 'CLP') return `${sign}$ ${abs.toLocaleString('es-CL')}`
  return `${sign}${currency} ${(abs / 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Parses a typed CLP amount ("$ 1.500" / "1500") into integer pesos; null when empty, NaN when invalid. */
export function parseMoney(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null
  const digits = String(raw).replace(/[$\s.]/g, '').replace(',', '.')
  const n = Number(digits)
  return Number.isFinite(n) ? Math.round(n) : Number.NaN
}

const INVOICE_STATUS: Record<InvoiceStatus, { label: string; severity: Severity }> = {
  draft: { label: 'Borrador', severity: 'secondary' },
  issued: { label: 'Emitida', severity: 'info' },
  paid: { label: 'Pagada', severity: 'success' },
  overdue: { label: 'Vencida', severity: 'danger' },
  void: { label: 'Anulada', severity: 'secondary' },
}

const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; severity: Severity }> = {
  trialing: { label: 'En prueba', severity: 'info' },
  active: { label: 'Al día', severity: 'success' },
  past_due: { label: 'Con deuda vencida', severity: 'warning' },
  suspended: { label: 'Suspendido', severity: 'danger' },
  canceled: { label: 'Cancelada', severity: 'secondary' },
}

export function invoiceStatus(status: string): { label: string; severity: Severity } {
  return INVOICE_STATUS[status as InvoiceStatus] ?? { label: status, severity: 'secondary' }
}

export function subscriptionStatus(status: string | null | undefined): { label: string; severity: Severity } {
  if (!status) return { label: 'Sin suscripción', severity: 'secondary' }
  return SUBSCRIPTION_STATUS[status as SubscriptionStatus] ?? { label: status, severity: 'secondary' }
}

export const INVOICE_STATUS_OPTIONS = (Object.keys(INVOICE_STATUS) as InvoiceStatus[]).map(value => ({ value, label: INVOICE_STATUS[value].label }))

export const PAYMENT_METHODS = [
  { value: 'invoice', label: 'Factura (pago por transferencia)' },
  { value: 'automatic', label: 'Automático (enlace de pago)' },
] as const

export function paymentMethodLabel(method: string | null | undefined): string {
  return method === 'automatic' ? 'Enlace de pago' : method === 'invoice' ? 'Transferencia' : (method ?? '—')
}

export function paymentChannelLabel(method: string): string {
  return ({ transfer: 'Transferencia', link: 'Pago en línea', manual: 'Manual', credit: 'Saldo a favor' } as Record<string, string>)[method] ?? method
}

export function intervalLabel(interval: string): string {
  return interval === 'annual' ? 'anual' : 'mensual'
}

/** 'YYYY-MM-DD' → 'DD-MM-YYYY' without time zone shifts. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  const [y, m, d] = date.slice(0, 10).split('-')
  return d && m && y ? `${d}-${m}-${y}` : date
}

export function periodLabel(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '—'
  return `${formatDate(start)} al ${formatDate(end)}`
}

/** ISO timestamp → 'DD-MM-YYYY' in the given time zone (default America/Santiago). */
export function formatDateTime(iso: string | null | undefined, timeZone = 'America/Santiago'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const parts = new Intl.DateTimeFormat('es-CL', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('day')}-${get('month')}-${get('year')}`
}

/** Consumption vs included: percent used (null when nothing included) and level. */
export function usageProgress(u: Pick<UsageEstimate, 'quantity' | 'cost' | 'included_quantity' | 'markup_percent'> & { meter: { valued_by_cost: boolean } }):
  { percent: number | null; level: 'ok' | 'warning' | 'over'; over: boolean } {
  const used = u.meter.valued_by_cost ? u.cost * (1 + (u.markup_percent ?? 0) / 100) : u.quantity
  const included = Number(u.included_quantity ?? 0)
  if (included <= 0) return { percent: null, level: used > 0 ? 'over' : 'ok', over: used > 0 }
  const percent = Math.round((used / included) * 100)
  return { percent, level: percent > 100 ? 'over' : percent >= 80 ? 'warning' : 'ok', over: percent > 100 }
}

/** "150 mensajes" style quantity (units from the meter catalog, AI cost in USD). */
export function formatQuantity(quantity: number, unit?: string | null): string {
  if (unit === 'USD') return `US$ ${quantity.toLocaleString('es-CL', { maximumFractionDigits: 2 })}`
  const n = quantity.toLocaleString('es-CL', { maximumFractionDigits: 2 })
  if (!unit) return n
  return `${n} ${quantity === 1 ? unit : pluralize(unit)}`
}

function pluralize(unit: string): string {
  if (/[aeiouáéíóú]$/i.test(unit)) return `${unit}s`
  if (/^[A-Z]+$/.test(unit)) return unit
  return `${unit}es`
}

export function eventLabel(event: string): string {
  return ({
    created: 'Creada', statement_added: 'Cobro agregado', issued: 'Emitida', sent: 'Enviada por correo',
    payment_applied: 'Pago aplicado', credit: 'Saldo a favor aplicado', overdue: 'Vencida',
    payment_link_created: 'Enlace de pago creado', voided: 'Anulada', reissued: 'Refacturada',
    credit_note: 'Nota de crédito', late_fee_waived: 'Interés condonado', reminder_sent: 'Recordatorio enviado',
    payment_released: 'Pago liberado (saldo a favor)', payment_reversed: 'Pago revertido',
  } as Record<string, string>)[event] ?? event
}

/** Banner of the backoffice for a subscription status (null = nothing to show). */
export function bannerFor(status: string | null | undefined): { severity: 'warning' | 'danger'; title: string; message: string } | null {
  if (status === 'past_due') {
    return { severity: 'warning', title: 'Tienes facturas vencidas', message: 'Regulariza el pago para evitar la suspensión del espacio.' }
  }
  if (status === 'suspended') {
    return { severity: 'danger', title: 'Espacio en solo lectura', message: 'El espacio está suspendido por facturas vencidas. Puedes consultar y pagar desde Facturación.' }
  }
  return null
}

/** Empty plan form. */
export function emptyPlan(): Omit<Plan, 'id'> {
  return {
    key: '', name: '', description: '', product: '', currency: 'CLP', interval: 'monthly', base_price: 0,
    included_seats: 0, seat_price: 0, trial_days: 0, tax_rate: 19, limits: {}, active: true, meters: [],
  }
}

/** Plan form → API payload (meters cleaned: valued-by-cost meters send markup, others unit price). */
export function planPayload(form: Omit<Plan, 'id'>, catalog: MeterDefinition[]): Record<string, any> {
  const byKey = new Map(catalog.map(m => [m.key, m]))
  return {
    key: form.key.trim(),
    name: form.name.trim(),
    description: form.description || null,
    product: form.product || null,
    interval: form.interval,
    base_price: Math.max(0, Math.round(Number(form.base_price) || 0)),
    included_seats: Math.max(0, Math.round(Number(form.included_seats) || 0)),
    seat_price: Math.max(0, Math.round(Number(form.seat_price) || 0)),
    trial_days: Math.max(0, Math.round(Number(form.trial_days) || 0)),
    tax_rate: Number(form.tax_rate) || 0,
    active: !!form.active,
    meters: form.meters.filter(m => m.meter).map((m) => {
      const def = byKey.get(m.meter)
      return {
        meter: m.meter,
        included_quantity: Math.max(0, Number(m.included_quantity) || 0),
        unit_price: def?.valued_by_cost ? 0 : Math.max(0, Math.round(Number(m.unit_price) || 0)),
        markup_percent: def?.valued_by_cost ? (m.markup_percent === null || m.markup_percent === undefined ? null : Number(m.markup_percent)) : null,
      }
    }),
  }
}

export function errorMessage(e: any, fallback: string): string {
  return e?.data?.message ?? (e?.data?.errors ? (Object.values(e.data.errors).flat()[0] as string) : null) ?? fallback
}

// ── Collections (stage 3) ────────────────────────────────────────────────────

export type AdjustmentType = 'discount' | 'surcharge' | 'one_off' | 'credit'
export type CreditNoteTarget = 'invoice' | 'balance' | 'next_period'

export interface Adjustment {
  id: string
  number: number | null
  display_number: string | null
  credit_note: boolean
  tenant_id: string | null
  client_id: string | null
  scope: 'space' | 'client'
  type: AdjustmentType
  amount: number | null
  percent: number | null
  recurring: boolean
  starts_at: string | null
  ends_at: string | null
  reason: string
  target: CreditNoteTarget | null
  invoice_id: string | null
  created_by: string | null
  created_at: string | null
  canceled_at: string | null
  cancel_reason: string | null
  status: 'pending' | 'applied' | 'canceled'
}

export interface LateFee { tenant_id: string; from: string; to: string; days: number; base: number; rate: number; amount: number; waived_at: string | null; waive_reason: string | null }

export const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string }[] = [
  { value: 'discount', label: 'Descuento' },
  { value: 'surcharge', label: 'Recargo' },
  { value: 'one_off', label: 'Cargo único' },
  { value: 'credit', label: 'Crédito' },
]

export const CREDIT_NOTE_TARGETS: { value: CreditNoteTarget; label: string; hint: string }[] = [
  { value: 'invoice', label: 'A una factura abierta', hint: 'Monto con IVA. Baja el saldo de la factura; lo que sobre queda a favor del cliente.' },
  { value: 'balance', label: 'Saldo a favor del cliente', hint: 'Monto con IVA. Se descuenta de la próxima factura que se emita.' },
  { value: 'next_period', label: 'Próximo cobro del espacio', hint: 'Monto neto (antes de IVA). Entra como línea en el próximo cierre.' },
]

export function adjustmentTypeLabel(type: string): string {
  return ADJUSTMENT_TYPES.find(t => t.value === type)?.label ?? type
}

/** "- $ 10.000" / "+ 15 %" with the sign of the type (discounts and credits reduce). */
export function adjustmentValue(a: Pick<Adjustment, 'type' | 'amount' | 'percent'>): string {
  const sign = a.type === 'discount' || a.type === 'credit' ? '-' : '+'
  if (a.percent !== null && a.percent !== undefined) return `${sign} ${Number(a.percent).toLocaleString('es-CL')} %`
  return `${sign} ${formatMoney(a.amount ?? 0)}`
}

export function adjustmentStatus(status: string): { label: string; severity: Severity } {
  return ({
    pending: { label: 'Pendiente', severity: 'info' },
    applied: { label: 'Aplicado', severity: 'success' },
    canceled: { label: 'Anulado', severity: 'secondary' },
  } as Record<string, { label: string; severity: Severity }>)[status] ?? { label: status, severity: 'secondary' }
}

export interface AdjustmentForm {
  scope: 'space' | 'client'
  tenant_key: string
  type: AdjustmentType
  mode: 'amount' | 'percent'
  value: string | number
  recurring: boolean
  starts_at: string
  ends_at: string
  reason: string
}

/** Adjustment form → payload, or the first error (client scope: percent discounts/surcharges only). */
export function adjustmentPayload(form: AdjustmentForm, clientId: string | null): { payload?: Record<string, any>; error?: string } {
  if (!form.reason.trim()) return { error: 'El motivo es obligatorio.' }
  if (form.scope === 'client') {
    if (!clientId) return { error: 'Falta el cliente.' }
    if (form.mode !== 'percent' || !['discount', 'surcharge'].includes(form.type)) return { error: 'A nivel de cliente solo se admiten descuentos o recargos porcentuales.' }
  } else if (!form.tenant_key) {
    return { error: 'Elige el espacio.' }
  }
  const n = form.mode === 'percent' ? Number(String(form.value).replace(',', '.')) : parseMoney(form.value)
  if (n === null || Number.isNaN(n) || n <= 0 || (form.mode === 'percent' && n > 100)) return { error: form.mode === 'percent' ? 'Ingresa un porcentaje entre 0 y 100.' : 'Ingresa un monto válido.' }
  if (form.starts_at && form.ends_at && form.ends_at < form.starts_at) return { error: 'La vigencia termina antes de empezar.' }
  const once = form.type === 'one_off' || form.type === 'credit'
  return {
    payload: {
      ...(form.scope === 'client' ? { client_id: clientId } : { tenant_key: form.tenant_key }),
      type: form.type,
      [form.mode]: form.mode === 'percent' ? n : Math.round(n),
      recurring: once ? false : !!form.recurring,
      starts_at: form.starts_at || null,
      ends_at: once ? null : (form.ends_at || null),
      reason: form.reason.trim(),
    },
  }
}

export interface CreditNoteForm { target: CreditNoteTarget; amount: string | number; reason: string; invoice_id: string; tenant_key: string }

export function creditNotePayload(form: CreditNoteForm, clientId: string): { payload?: Record<string, any>; error?: string } {
  const amount = parseMoney(form.amount)
  if (!amount || Number.isNaN(amount) || amount <= 0) return { error: 'Ingresa un monto válido.' }
  if (!form.reason.trim()) return { error: 'El motivo es obligatorio.' }
  if (form.target === 'invoice' && !form.invoice_id) return { error: 'Elige la factura.' }
  if (form.target === 'next_period' && !form.tenant_key) return { error: 'Elige el espacio.' }
  return {
    payload: {
      client_id: clientId, amount, reason: form.reason.trim(), target: form.target,
      invoice_id: form.target === 'invoice' ? form.invoice_id : null,
      tenant_key: form.target === 'next_period' ? form.tenant_key : null,
    },
  }
}

export interface CorrectionLine { description: string; amount: string | number; tenant_key?: string }

/** Reissue form → payload: only changed billing fields, correction lines with a non-zero signed amount. */
export function reissuePayload(form: { reason: string; billing_data: Record<string, string>; original: Record<string, string | null>; lines: CorrectionLine[]; due_at: string; send: boolean }):
  { payload?: Record<string, any>; error?: string } {
  if (!form.reason.trim()) return { error: 'El motivo es obligatorio.' }
  const billing: Record<string, string> = {}
  for (const [k, v] of Object.entries(form.billing_data)) {
    if ((v ?? '') !== (form.original[k] ?? '')) billing[k] = v
  }
  const lines = []
  for (const l of form.lines) {
    if (!l.description?.trim() && (l.amount === '' || l.amount === null || l.amount === undefined)) continue
    const raw = String(l.amount ?? '').trim()
    const negative = raw.startsWith('-')
    const n = parseMoney(raw.replace(/^-/, ''))
    if (!l.description?.trim() || n === null || Number.isNaN(n) || n === 0) return { error: 'Cada corrección necesita descripción y un monto distinto de cero.' }
    lines.push({ description: l.description.trim(), amount: negative ? -n : n, tenant_key: l.tenant_key || null })
  }
  return {
    payload: {
      reason: form.reason.trim(),
      billing_data: Object.keys(billing).length ? billing : null,
      lines,
      due_at: form.due_at || null,
      send: form.send,
    },
  }
}

export const BILLING_FIELDS: { key: string; label: string }[] = [
  { key: 'legal_name', label: 'Razón social' },
  { key: 'tax_id', label: 'RUT' },
  { key: 'business_activity', label: 'Giro' },
  { key: 'address', label: 'Dirección' },
  { key: 'billing_email', label: 'Correo de facturación' },
]

// ── Reconciliation ───────────────────────────────────────────────────────────

export type TransactionStatus = 'unmatched' | 'suggested' | 'matched' | 'ignored'

export interface Suggestion { client_id: string; client_name: string; invoice_ids: string[]; invoices: string[]; amount: number; score: number; reasons: string[] }

export interface BankTransaction {
  id: string
  import_id: string
  posted_at: string
  amount: number
  description: string | null
  reference: string | null
  tax_id: string | null
  counterpart_name: string | null
  status: TransactionStatus
  score: number | null
  suggestions: Suggestion[]
  client_id: string | null
  client_name: string | null
  payment_id: string | null
  matched_by: string | null
  matched_at: string | null
  ignore_reason: string | null
}

export const BANK_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: 'date', label: 'Fecha', hint: 'obligatoria' },
  { key: 'credit', label: 'Abonos', hint: 'o "Monto"' },
  { key: 'debit', label: 'Cargos', hint: 'opcional' },
  { key: 'amount', label: 'Monto (con signo)', hint: 'si no hay abonos/cargos' },
  { key: 'description', label: 'Descripción / glosa' },
  { key: 'reference', label: 'N° de documento / referencia' },
  { key: 'tax_id', label: 'RUT de origen' },
  { key: 'name', label: 'Nombre de origen' },
]

/** null when the mapping can be imported; otherwise the problem. */
export function mappingError(mapping: Record<string, string | null | undefined>): string | null {
  if (!mapping.date) return 'Elige la columna de fecha.'
  if (!mapping.credit && !mapping.amount) return 'Elige la columna de abonos o la de monto.'
  const used = Object.values(mapping).filter(Boolean)
  if (new Set(used).size !== used.length) return 'Una columna está asignada a dos campos.'
  return null
}

export function transactionStatus(status: string): { label: string; severity: Severity } {
  return ({
    unmatched: { label: 'Sin emparejar', severity: 'warning' },
    suggested: { label: 'Con sugerencia', severity: 'info' },
    matched: { label: 'Conciliado', severity: 'success' },
    ignored: { label: 'Descartado', severity: 'secondary' },
  } as Record<string, { label: string; severity: Severity }>)[status] ?? { label: status, severity: 'secondary' }
}

export function importStatus(status: string): { label: string; severity: Severity } {
  return ({
    pending: { label: 'En cola', severity: 'secondary' },
    processing: { label: 'Procesando', severity: 'info' },
    done: { label: 'Lista', severity: 'success' },
    failed: { label: 'Con error', severity: 'danger' },
  } as Record<string, { label: string; severity: Severity }>)[status] ?? { label: status, severity: 'secondary' }
}

export function matchReasonLabel(reason: string): string {
  return ({
    tax_id: 'RUT', tax_id_in_text: 'RUT en la glosa', reference: 'N° de factura', name: 'Nombre',
    amount_exact: 'Monto exacto', amount_sum: 'Suma de facturas', amount_total: 'Total de la factura', partial: 'Pago parcial',
  } as Record<string, string>)[reason] ?? reason
}

export function scoreSeverity(score: number | null | undefined): Severity {
  if (!score) return 'secondary'
  return score >= 85 ? 'success' : score >= 60 ? 'info' : 'warning'
}

/** How a movement would be applied to the chosen invoices, in order; what is left becomes client credit. */
export function allocationPreview(amount: number, invoices: { id: string; balance: number }[], selected: string[]):
  { rows: { id: string; applied: number; remaining: number }[]; credit: number } {
  let left = Math.max(0, Math.round(amount))
  const rows = []
  for (const id of selected) {
    const inv = invoices.find(i => i.id === id)
    if (!inv) continue
    const applied = Math.min(left, inv.balance)
    left -= applied
    rows.push({ id, applied, remaining: inv.balance - applied })
  }
  return { rows, credit: left }
}

// ── Account statement, reports, reminders ─────────────────────────────────

export const AGING_BUCKETS: { key: string; label: string }[] = [
  { key: 'current', label: 'Por vencer' },
  { key: 'd0_30', label: '0–30 días' },
  { key: 'd31_60', label: '31–60 días' },
  { key: 'd61_90', label: '61–90 días' },
  { key: 'd90_plus', label: 'Más de 90 días' },
]

export function movementLabel(type: string): string {
  return ({ invoice: 'Factura', payment: 'Pago', credit_note: 'Nota de crédito', void: 'Anulación' } as Record<string, string>)[type] ?? type
}

export const REPORTS: { key: string; label: string; dated: boolean; groups: { value: string; label: string }[] }[] = [
  { key: 'revenue', label: 'Ingresos', dated: true, groups: [{ value: 'month', label: 'Mes' }, { value: 'client', label: 'Cliente' }, { value: 'plan', label: 'Plan' }, { value: 'product', label: 'Producto' }] },
  { key: 'receivables', label: 'Cuentas por cobrar', dated: false, groups: [] },
  { key: 'aging', label: 'Antigüedad de deuda', dated: false, groups: [] },
  { key: 'collections', label: 'Recaudación', dated: true, groups: [{ value: 'month', label: 'Mes' }, { value: 'method', label: 'Medio de pago' }, { value: 'client', label: 'Cliente' }] },
  { key: 'mrr', label: 'MRR', dated: false, groups: [{ value: 'client', label: 'Cliente' }, { value: 'plan', label: 'Plan' }, { value: 'product', label: 'Producto' }] },
  { key: 'usage', label: 'Consumo', dated: true, groups: [] },
]

const MONEY_COLUMNS = new Set(['subtotal', 'tax', 'total', 'balance', 'amount', 'credit', 'mrr', 'cost', 'current', 'd0_30', 'd31_60', 'd61_90', 'd90_plus'])

/** Cell text of a report: money columns as pesos, numbers with es-CL separators. */
export function reportCell(column: string, value: any): string {
  if (value === null || value === undefined || value === '') return '—'
  if (MONEY_COLUMNS.has(column) && typeof value === 'number') return formatMoney(value)
  if (typeof value === 'number') return value.toLocaleString('es-CL', { maximumFractionDigits: 4 })
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return formatDate(String(value))
  return String(value)
}

export function isNumericColumn(column: string): boolean {
  return MONEY_COLUMNS.has(column) || ['invoices', 'payments', 'spaces', 'quantity', 'records', 'days_overdue'].includes(column)
}

/** "7, 3" → [7, 3] (descending, unique, 1–60); null when invalid. */
export function parseReminderDays(raw: string | null | undefined): number[] | null {
  const text = String(raw ?? '').trim()
  if (!text) return []
  if (!/^\d{1,2}(\s*,\s*\d{1,2})*$/.test(text)) return null
  const days = [...new Set(text.split(',').map(d => Number(d.trim())))].filter(d => d > 0 && d <= 60)
  return days.sort((a, b) => b - a)
}

/** Default date range: from the first day of the current year to today (YYYY-MM-DD, local). */
export function yearToDate(now = new Date()): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` }
}

export function activityLabel(subject: string, action: string): string {
  const subjects: Record<string, string> = {
    adjustment: 'Ajuste', credit_note: 'Nota de crédito', invoice: 'Factura', terms: 'Condiciones de cobranza',
    bank_import: 'Cartola', bank_transaction: 'Movimiento bancario', late_fee: 'Interés por mora', credit: 'Saldo a favor',
  }
  const actions: Record<string, string> = {
    created: 'creado', canceled: 'anulado', voided: 'anulada', reissued: 'refacturada', updated: 'actualizadas',
    processed: 'importada', matched: 'conciliado a mano', auto_matched: 'conciliado automáticamente', unmatched: 'desconciliado',
    ignored: 'descartado', restored: 'restaurado', waived: 'condonado', applied: 'aplicado',
  }
  return `${subjects[subject] ?? subject} ${actions[action] ?? action}`
}
