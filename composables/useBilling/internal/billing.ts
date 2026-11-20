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
