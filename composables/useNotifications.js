/**
 * Centro de notificaciones del usuario. Habla con los endpoints del notification
 * center de innertia-laravel (prefijo `notifications`, montado con
 * \Innertia\Saas\Notifications::routes()):
 *   GET    notifications            ?all=1&page=N  → {data,total,unread,current_page,last_page}
 *   PATCH  notifications/{id}/read
 *   PATCH  notifications/read-all
 *   DELETE notifications/{id}
 *   DELETE notifications                            (borra las leídas)
 */
export function useNotifications() {
  const api = useApi()
  const store = useNotificationsStore()

  async function fetchNotifications(params = {}) {
    const res = await api.get('notifications', { params })
    store.setNotifications(res?.data ?? [])
    return res
  }

  async function markAsRead(id) {
    await api.patch(`notifications/${id}/read`)
    store.markRead(id)
  }

  async function markAllAsRead() {
    await api.patch('notifications/read-all')
    store.markAllRead()
  }

  async function remove(id) {
    await api.delete(`notifications/${id}`)
    store.remove(id)
  }

  return { fetchNotifications, markAsRead, markAllAsRead, remove }
}
