/**
 * Pure helpers for the Integrations screens (API keys + webhooks), no Nuxt/Vue: testable in node.
 * Consumed by useApiKeys / useWebhooks and <Integrations.ApiKeys> / <Integrations.Webhooks>.
 * Backend: innertia-laravel \Innertia\PublicApi\Routes::manage().
 */

export type Severity = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'

export type ApiKeyStatus = 'active' | 'expiring' | 'expired' | 'revoked'
export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying'

export interface ApiKey {
  id: string
  name: string
  prefix: string
  hint?: string | null
  scopes: string[]
  organization_id?: string | null
  expires_at?: string | null
  last_used_at?: string | null
  last_used_ip?: string | null
  created_by?: string | null
  revoked_at?: string | null
  rotated_to_id?: string | null
  status: ApiKeyStatus
  created_at?: string | null
}

export interface ApiScope { key: string; description?: string | null; group?: string | null }

export interface Webhook {
  id: string | number
  url: string
  description?: string | null
  events: string[]
  active: boolean
  organization_id?: string | null
  scopes?: string[]
  secret_hint?: string | null
  previous_secret_expires_at?: string | null
  disabled_at?: string | null
  disabled_reason?: string | null
  failing_since?: string | null
  last_success_at?: string | null
  last_failure_at?: string | null
  legacy?: boolean
  created_at?: string | null
}

export interface WebhookEvent { key: string; description?: string | null; version?: string | null; scope?: string | null; example?: any }

export interface WebhookLog {
  id: string | number
  message_id?: string | null
  event_key: string
  status: DeliveryStatus
  attempts?: number
  response_status?: number | null
  duration_ms?: number | null
  error?: string | null
  is_test?: boolean
  created_at?: string | null
  delivered_at?: string | null
  failed_at?: string | null
  next_retry_at?: string | null
  [key: string]: any
}

// ── Status labels ────────────────────────────────────────────────────────────

export const API_KEY_STATUS: Record<ApiKeyStatus, { label: string; severity: Severity }> = {
  active:   { label: 'Activa', severity: 'success' },
  expiring: { label: 'Por vencer', severity: 'warning' },
  expired:  { label: 'Vencida', severity: 'secondary' },
  revoked:  { label: 'Revocada', severity: 'danger' },
}

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; severity: Severity }> = {
  pending:   { label: 'Pendiente', severity: 'info' },
  delivered: { label: 'Entregado', severity: 'success' },
  retrying:  { label: 'Reintentando', severity: 'warning' },
  failed:    { label: 'Fallido', severity: 'danger' },
}

export function apiKeyStatus(status: string | null | undefined) {
  return API_KEY_STATUS[status as ApiKeyStatus] ?? { label: status || '—', severity: 'secondary' as Severity }
}

export function deliveryStatus(status: string | null | undefined) {
  return DELIVERY_STATUS[status as DeliveryStatus] ?? { label: status || '—', severity: 'secondary' as Severity }
}

/** Webhook state: disabled by health check, paused by a user, or active. */
export function webhookState(w: Pick<Webhook, 'active' | 'disabled_at' | 'failing_since'>): { label: string; severity: Severity } {
  if (w.disabled_at) return { label: 'Desactivado por fallas', severity: 'danger' }
  if (!w.active) return { label: 'Pausado', severity: 'secondary' }
  if (w.failing_since) return { label: 'Con fallas', severity: 'warning' }
  return { label: 'Activo', severity: 'success' }
}

/** Severity for an HTTP status code shown in logs. */
export function httpSeverity(status: number | null | undefined): Severity {
  if (!status) return 'secondary'
  if (status < 300) return 'success'
  if (status < 400) return 'info'
  if (status === 429 || status < 500) return 'warning'
  return 'danger'
}

// ── Scopes ───────────────────────────────────────────────────────────────────

/** Resource of a scope: `calls:read` → `calls`, `people:pii` → `people`. */
export function scopeResource(scope: string): string {
  const i = scope.indexOf(':')
  return i === -1 ? scope : scope.slice(0, i)
}

/** Groups scopes by `group` (or the resource of the key), keeping the server order. */
export function groupScopes(scopes: ApiScope[]): { group: string; items: ApiScope[] }[] {
  const groups: { group: string; items: ApiScope[] }[] = []
  for (const s of scopes) {
    const g = s.group || scopeResource(s.key)
    let entry = groups.find(x => x.group === g)
    if (!entry) groups.push(entry = { group: g, items: [] })
    entry.items.push(s)
  }
  return groups
}

export function toggleValue(list: string[], value: string, on: boolean): string[] {
  const set = new Set(list)
  on ? set.add(value) : set.delete(value)
  return [...set]
}

// ── Events (wildcards) ───────────────────────────────────────────────────────

/** Family of an event key: `call.ended` → `call`. */
export function eventFamily(key: string): string {
  const i = key.indexOf('.')
  return i === -1 ? key : key.slice(0, i)
}

/** Does a subscription pattern (`*`, `call.*`, `call.ended`) match the event key? */
export function eventMatches(pattern: string, key: string): boolean {
  if (pattern === '*') return true
  if (pattern.endsWith('.*')) return key.startsWith(pattern.slice(0, -1))
  return pattern === key
}

/** Is the event covered by the selection (directly or by a wildcard)? */
export function isEventSelected(selection: string[], key: string): boolean {
  return selection.some(p => eventMatches(p, key))
}

export function groupEvents(events: WebhookEvent[]): { family: string; items: WebhookEvent[] }[] {
  const groups: { family: string; items: WebhookEvent[] }[] = []
  for (const e of events) {
    const f = eventFamily(e.key)
    let entry = groups.find(x => x.family === f)
    if (!entry) groups.push(entry = { family: f, items: [] })
    entry.items.push(e)
  }
  return groups
}

/**
 * Toggles a whole family as `family.*`: on → replaces its individual events with the wildcard;
 * off → removes the wildcard and every individual event of the family.
 */
export function toggleFamily(selection: string[], family: string, on: boolean): string[] {
  const rest = selection.filter(p => p !== `${family}.*` && eventFamily(p) !== family)
  return on ? [...rest, `${family}.*`] : rest
}

/**
 * Toggles one event. Turning one off while its family wildcard (or `*`) is selected expands the
 * wildcard into the remaining events of the catalog.
 */
export function toggleEvent(selection: string[], key: string, on: boolean, catalog: WebhookEvent[]): string[] {
  if (on) return isEventSelected(selection, key) ? selection : [...selection, key]

  const family = eventFamily(key)
  let next = selection
  if (next.includes('*')) {
    next = [...next.filter(p => p !== '*'), ...[...new Set(catalog.map(e => eventFamily(e.key)))].map(f => `${f}.*`)]
  }
  if (next.includes(`${family}.*`)) {
    const siblings = catalog.map(e => e.key).filter(k => eventFamily(k) === family && k !== key)
    next = [...next.filter(p => p !== `${family}.*`), ...siblings]
  }
  return next.filter(p => p !== key)
}

export function familyState(selection: string[], family: string, catalog: WebhookEvent[]): 'all' | 'some' | 'none' {
  if (selection.includes('*') || selection.includes(`${family}.*`)) return 'all'
  const keys = catalog.map(e => e.key).filter(k => eventFamily(k) === family)
  const n = keys.filter(k => selection.includes(k)).length
  return n === 0 ? 'none' : n === keys.length ? 'all' : 'some'
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Webhook URL: absolute https with a host (the server also blocks private addresses). */
export function validateWebhookUrl(url: string): string | null {
  const v = (url || '').trim()
  if (!v) return 'Ingresa la URL del receptor.'
  let parsed: URL
  try { parsed = new URL(v) } catch { return 'La URL no es válida.' }
  if (parsed.protocol !== 'https:') return 'La URL debe usar https.'
  if (!parsed.hostname) return 'La URL no es válida.'
  if (parsed.username || parsed.password) return 'La URL no puede incluir credenciales.'
  return null
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** Relative Spanish label ("hace 5 min", "en 3 días"). */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const diff = Math.round((d.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diff)
  const fmt = (n: number, unit: string) => (diff < 0 ? `hace ${n} ${unit}` : `en ${n} ${unit}`)
  if (abs < 45) return diff < 0 ? 'recién' : 'en unos segundos'
  if (abs < 3600) return fmt(Math.round(abs / 60), 'min')
  if (abs < 86400) { const h = Math.round(abs / 3600); return fmt(h, h === 1 ? 'hora' : 'horas') }
  const days = Math.round(abs / 86400)
  if (days < 30) return fmt(days, days === 1 ? 'día' : 'días')
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Expiry label for an API key. */
export function expiryLabel(expiresAt: string | null | undefined, now: Date = new Date()): string {
  if (!expiresAt) return 'Sin vencimiento'
  const d = new Date(expiresAt)
  if (isNaN(d.getTime())) return 'Sin vencimiento'
  return d.getTime() <= now.getTime() ? `Venció ${relativeTime(expiresAt, now)}` : `Vence ${relativeTime(expiresAt, now)}`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Expiry presets for the create form → ISO date (null = never). */
export const EXPIRY_PRESETS = [
  { value: '', label: 'Sin vencimiento' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '365', label: '1 año' },
]

export function expiryFromPreset(days: string, now: Date = new Date()): string | null {
  const n = Number(days)
  if (!days || !Number.isFinite(n) || n <= 0) return null
  return new Date(now.getTime() + n * 86400000).toISOString()
}

/** Appends a cursor page to the accumulated list (dedup by id). */
export function appendPage<T extends { id: string | number }>(items: T[], page: T[]): T[] {
  const seen = new Set(items.map(i => String(i.id)))
  return [...items, ...page.filter(i => !seen.has(String(i.id)))]
}

/** Pretty JSON for payload/headers previews. */
export function prettyJson(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
  }
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}
