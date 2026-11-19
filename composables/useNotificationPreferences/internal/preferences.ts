// Lógica pura de preferencias de avisos (espejo de \Innertia\Notifications\Preferences).
// Los tipos críticos llegan `locked` y nunca se envían al servidor (que igual los ignora).

export type Channel = 'bell' | 'mail'
export const CHANNELS: Channel[] = ['bell', 'mail']

export interface ChannelState { enabled: boolean; locked: boolean; available: boolean }

export interface NoticeTypePreference {
  key: string
  label: string
  description?: string
  critical: boolean
  category?: string | null
  channels: Channel[]
  preferences: Record<Channel, ChannelState>
}

export interface PreferenceChange { type: string; channel: Channel; enabled: boolean }

export const CHANNEL_LABELS: Record<Channel, string> = { bell: 'Campanita', mail: 'Correo' }

/** Copia profunda editable (el formulario no muta lo que vino del servidor). */
export function clonePreferences(items: NoticeTypePreference[] | null | undefined): NoticeTypePreference[] {
  return (items ?? []).map(t => ({
    ...t,
    preferences: Object.fromEntries(CHANNELS.map(c => [c, { ...t.preferences[c] }])) as Record<Channel, ChannelState>,
  }))
}

/** Cambia un canal; los bloqueados (críticos) no cambian. Devuelve una lista nueva. */
export function togglePreference(items: NoticeTypePreference[], key: string, channel: Channel, enabled: boolean): NoticeTypePreference[] {
  return items.map((t) => {
    if (t.key !== key) return t
    const state = t.preferences[channel]
    if (!state || state.locked || !state.available) return t
    return { ...t, preferences: { ...t.preferences, [channel]: { ...state, enabled } } }
  })
}

/** Cambios respecto de lo guardado (solo canales no bloqueados). */
export function diffPreferences(original: NoticeTypePreference[], current: NoticeTypePreference[]): PreferenceChange[] {
  const before = new Map(original.map(t => [t.key, t]))
  const changes: PreferenceChange[] = []
  for (const t of current) {
    for (const channel of CHANNELS) {
      const now = t.preferences[channel]
      const prev = before.get(t.key)?.preferences[channel]
      if (!now || now.locked || !now.available) continue
      if (!prev || prev.enabled !== now.enabled) changes.push({ type: t.key, channel, enabled: now.enabled })
    }
  }
  return changes
}

/** Agrupa por categoría (null → 'Generales'; 'account' → 'Cuenta'), conservando el orden. */
export function groupByCategory(items: NoticeTypePreference[]): { category: string; label: string; items: NoticeTypePreference[] }[] {
  const labels: Record<string, string> = { account: 'Cuenta y seguridad' }
  const groups = new Map<string, NoticeTypePreference[]>()
  for (const t of items) {
    const cat = t.category || 'general'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(t)
  }
  return [...groups.entries()].map(([category, list]) => ({ category, label: labels[category] ?? (category === 'general' ? 'Avisos' : category), items: list }))
}
