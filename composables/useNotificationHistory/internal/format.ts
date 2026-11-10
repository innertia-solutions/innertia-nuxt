/**
 * Helpers puros de la vista de historial de notificaciones (sin Nuxt/Vue),
 * testeables en node. Los consume useNotificationHistory / <App.NotificationHistory>.
 */

export type HistoryFilter = 'all' | 'unread'

export interface NotificationItem {
  id: string
  title?: string | null
  body?: string | null
  data?: Record<string, any> | null
  read_at?: string | null
  created_at?: string | null
  [key: string]: any
}

/** Query params para GET notifications (el backend lista solo no leídas si no va `all`). */
export function historyParams({ filter, page, perPage }: { filter: HistoryFilter; page: number; perPage: number }) {
  return filter === 'all'
    ? { all: 1, page, per_page: perPage }
    : { page, per_page: perPage }
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Agrupa (ya ordenadas por fecha desc) en Hoy / Ayer / fecha larga. */
export function groupByDay<T extends { created_at?: string | null }>(items: T[], now: Date = new Date()) {
  const today = dayKey(now)
  const y = new Date(now); y.setDate(y.getDate() - 1)
  const yesterday = dayKey(y)

  const groups: { key: string; label: string; items: T[] }[] = []
  for (const item of items) {
    const d = item.created_at ? new Date(item.created_at) : null
    const key = d ? dayKey(d) : 'none'
    let g = groups.find(g => g.key === key)
    if (!g) {
      const label = !d ? 'Sin fecha'
        : key === today ? 'Hoy'
        : key === yesterday ? 'Ayer'
        : d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
      g = { key, label, items: [] }
      groups.push(g)
    }
    g.items.push(item)
  }
  return groups
}

/** "hace 5 min", "hace 3 h", "hace 2 d" o fecha corta. */
export function timeAgo(iso: string | null | undefined, now: Date = new Date()) {
  if (!iso) return ''
  const d = new Date(iso)
  const s = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (s < 60) return 'hace un momento'
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`
  const days = Math.floor(h / 24); if (days < 7) return `hace ${days} d`
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

/** Destino por defecto al abrir una notificación: data.link → data.url → null. */
export function defaultNotificationLink(n: NotificationItem): string | null {
  return n?.data?.link ?? n?.data?.url ?? null
}
