import { defineStore } from 'pinia'

/**
 * Gym activo en modo 'open'.
 * A diferencia de saas (tenant por subdominio), open resuelve el tenant por
 * selección in-app: el usuario elige entre sus gyms y esa key viaja como X-Tenant.
 * gyms: [{ key, name, status, contexts }]
 */
export const useGymStore = defineStore('gym', {
  state: () => ({ activeKey: null, gyms: [] }),

  getters: {
    active: (s) => s.gyms.find((g) => g.key === s.activeKey) || null,
    hasMultiple: (s) => s.gyms.length > 1,
  },

  actions: {
    setGyms(gyms) { this.gyms = gyms || [] },
    setActive(key) { this.activeKey = key },
    reset() { this.activeKey = null; this.gyms = [] },
  },

  persist: {
    // Solo la key activa sobrevive el refresh; la lista se recarga del backend
    pick: ['activeKey'],
  },
})
