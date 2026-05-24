export function useNotifications() {
  const api = useApi()
  const store = useNotificationsStore()

  async function fetchNotifications(params = {}) {
    const data = await api.get('auth/me/notifications', { params })
    store.setNotifications(data?.data ?? data ?? [])
    return data
  }

  async function markAsRead(id) {
    await api.put(`auth/me/notifications/${id}/read`)
    store.markRead(id)
  }

  async function markAllAsRead() {
    await api.put('auth/me/notifications/read-all')
    store.markAllRead()
  }

  return { fetchNotifications, markAsRead, markAllAsRead }
}
