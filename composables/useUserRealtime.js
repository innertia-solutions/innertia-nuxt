export function useUserRealtime() {
  const authStore = useAuthStore()
  const notificationsStore = useNotificationsStore()

  function start() {
    const userId = authStore.user?.id
    if (!userId) return
    const { subscribe } = useRealtime()
    subscribe(`private-user.${userId}`, {
      'NotificationSent': (payload) => {
        notificationsStore.addNotification(payload)
      }
    })
  }

  return { start }
}
