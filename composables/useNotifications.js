/**
 * Centro de notificaciones del usuario. Habla con los endpoints del notification
 * center de innertia-laravel (prefijo `notifications`, montado con
 * \Innertia\Saas\Notifications::routes()):
 *   GET    notifications            ?all=1&page=N  → {data,total,unread,current_page,last_page}
 *   PATCH  notifications/{id}/read
 *   PATCH  notifications/read-all
 *   DELETE notifications/{id}
 *   DELETE notifications                            (borra las leídas)
 *
 * `base` (opcional): prefijo de las rutas. En /platform la campanita usa
 * `useNotifications({ base: 'platform/notifications' })` (el producto monta
 * \Innertia\Notifications\Routes::register('notifications') dentro de su grupo platform).
 */
export function useNotifications(options = {}) {
  const api = useApi()
  const store = useNotificationsStore()
  const base = String(options.base || 'notifications').replace(/^\/+|\/+$/g, '')

  async function fetchNotifications(params = {}) {
    const res = await api.get(base, { params })
    store.setNotifications(res?.data ?? [])
    return res
  }

  async function markAsRead(id) {
    await api.patch(`${base}/${id}/read`)
    store.markRead(id)
  }

  async function markAllAsRead() {
    await api.patch(`${base}/read-all`)
    store.markAllRead()
  }

  async function remove(id) {
    await api.delete(`${base}/${id}`)
    store.remove(id)
  }

  return { fetchNotifications, markAsRead, markAllAsRead, remove }
}
