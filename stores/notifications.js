import { defineStore } from 'pinia'

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    notifications: [],
  }),
  getters: {
    unreadCount: (state) => state.notifications.filter(n => !n.read_at).length,
  },
  actions: {
    setNotifications(items) { this.notifications = items },
    addNotification(item) { this.notifications.unshift(item) },
    markRead(id) {
      const n = this.notifications.find(n => n.id === id)
      if (n) n.read_at = new Date().toISOString()
    },
    markAllRead() {
      const now = new Date().toISOString()
      this.notifications.forEach(n => { if (!n.read_at) n.read_at = now })
    },
    remove(id) { this.notifications = this.notifications.filter(n => n.id !== id) },
    clear() { this.notifications = [] },
  },
  persist: false,
})
