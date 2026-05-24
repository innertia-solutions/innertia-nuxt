import { defineStore } from 'pinia'

// Storage SSR-safe: null en servidor, localStorage en cliente
const clientStorage = typeof window !== 'undefined' ? window.localStorage : null

/**
 * Store persistido en localStorage para los previews minimizados.
 * Sobrevive recargas y se sincroniza entre pestañas (via plugin dockedPreviewsSync).
 */
export const useDockedPreviewsStore = defineStore('docked-previews', {
  state: () => ({
    items: [],
  }),

  actions: {
    add({ id, label, subtitle, row, tableName, route }) {
      if (this.items.find(d => d.id === id)) return
      this.items.push({ id, label, subtitle: subtitle ?? null, row, tableName, route })
    },

    remove(id) {
      this.items = this.items.filter(d => d.id !== id)
    },

    /** Sincroniza el estado desde otra pestaña (llamado por el plugin de storage). */
    hydrate(items) {
      this.items = items
    },
  },

  persist: {
    storage: clientStorage,
  },
})
