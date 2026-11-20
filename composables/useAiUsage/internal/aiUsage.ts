/**
 * Pure helpers for the AI pricing/usage screens (no Nuxt/Vue: testable in node).
 * Backend: innertia-laravel \Innertia\Ai\Routes (platform: ai/models/prices, ai/usage/report;
 * backoffice: ai/usage/summary).
 */

export type PriceField = 'price_input_per_mtok' | 'price_output_per_mtok' | 'price_per_audio_minute' | 'price_per_mchar_tts'

export const PRICE_FIELDS: { key: PriceField; label: string; hint: string }[] = [
  { key: 'price_input_per_mtok', label: 'Entrada', hint: 'USD por 1M tokens' },
  { key: 'price_output_per_mtok', label: 'Salida', hint: 'USD por 1M tokens' },
  { key: 'price_per_audio_minute', label: 'Audio', hint: 'USD por minuto' },
  { key: 'price_per_mchar_tts', label: 'Voz (TTS)', hint: 'USD por 1M caracteres' },
]

export interface AiModelPrice {
  id: string
  key: string
  name: string
  active: boolean
  capabilities: string[]
  provider: { id: string; key: string; name: string } | null
  prices: Record<PriceField, number | null>
  priced: boolean
}

export interface UsageTotals {
  events: number
  cost_usd: number
  input_tokens: number
  output_tokens: number
  audio_seconds: number
  tts_chars: number
  unpriced_events: number
}

export interface UsageSummary {
  from: string
  to: string
  timezone: string
  tenant_id?: string | null
  totals: UsageTotals
  by_feature: (UsageTotals & { feature: string | null })[]
  by_model: (UsageTotals & { model: string | null })[]
  daily: (UsageTotals & { date: string })[]
  by_tenant?: (UsageTotals & { tenant_id: string | null; tenant_key?: string | null; tenant_name?: string | null })[]
}

export const FEATURE_LABELS: Record<string, string> = {
  call_summary: 'Resumen de llamadas',
  transcription: 'Transcripción',
  live_copilot: 'Copiloto en vivo',
  assistant: 'Asistente',
  tts: 'Voz (TTS)',
  voice_agent: 'Agente de voz',
  import_pdf: 'Importación de PDF',
  chat: 'Chat',
  embedding: 'Embeddings',
  vision: 'Visión',
}

export function featureLabel(key: string | null | undefined): string {
  if (!key) return 'Sin clasificar'
  return FEATURE_LABELS[key] ?? key.replace(/[_.-]+/g, ' ').replace(/^./, c => c.toUpperCase())
}

/** USD with adaptive precision: small amounts keep 4 decimals ($0.0042), larger ones 2. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const v = Number(value)
  const digits = v !== 0 && Math.abs(v) < 1 ? 4 : 2
  return 'US$ ' + v.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** 1234567 → "1,2 M"; 15300 → "15,3 mil"; 950 → "950". */
export function compactNumber(value: number | null | undefined): string {
  const v = Number(value ?? 0)
  const abs = Math.abs(v)
  const fmt = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 })
  if (abs >= 1_000_000) return `${fmt(v / 1_000_000)} M`
  if (abs >= 10_000) return `${fmt(v / 1_000)} mil`
  return Math.round(v).toLocaleString('es-CL')
}

/** Human summary of the units of a row: "1,2 M tokens · 3 min de audio · 4,5 mil caracteres". */
export function unitsLabel(t: Partial<UsageTotals>): string {
  const parts: string[] = []
  const tokens = (t.input_tokens ?? 0) + (t.output_tokens ?? 0)
  if (tokens > 0) parts.push(`${compactNumber(tokens)} tokens`)
  if ((t.audio_seconds ?? 0) > 0) parts.push(`${formatMinutes(t.audio_seconds!)} de audio`)
  if ((t.tts_chars ?? 0) > 0) parts.push(`${compactNumber(t.tts_chars)} caracteres`)
  return parts.join(' · ') || '—'
}

export function formatMinutes(seconds: number): string {
  const min = seconds / 60
  return `${min.toLocaleString('es-CL', { maximumFractionDigits: min < 10 ? 1 : 0 })} min`
}

/** 'YYYY-MM' of a date (local). */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Shift a 'YYYY-MM' month by n months. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return monthKey(d)
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const name = MONTHS[(m - 1) % 12] ?? month
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}

/** Bar heights (0-100) for a daily series, relative to its max. */
export function barHeights(values: number[]): number[] {
  const max = Math.max(0, ...values)
  return values.map(v => (max > 0 ? Math.round((v / max) * 100) : 0))
}

/** Budget usage: percent and level (ok < 80 ≤ warning < 100 ≤ over). */
export function budgetState(cost: number, budget: number | null | undefined): { percent: number; level: 'ok' | 'warning' | 'over' } | null {
  if (!budget || budget <= 0) return null
  const percent = Math.round((cost / budget) * 100)
  return { percent, level: percent >= 100 ? 'over' : percent >= 80 ? 'warning' : 'ok' }
}

/** Normalizes a price input ("" → null, "1,5" → 1.5). Returns undefined when invalid. */
export function parsePrice(raw: string | number | null | undefined): number | null | undefined {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim().replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
