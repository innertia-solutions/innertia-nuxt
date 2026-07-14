import { defineStore } from 'pinia'

/**
 * Gym activo en modo 'open'.
 * A diferencia de saas (tenant por subdominio), open resuelve el tenant por
 * selección in-app: el usuario elige entre sus gyms y esa key viaja como X-Tenant.
 * gyms: [{ key, name, status, contexts }]
 */
export const useGymStore = defineStore('gym', {
  state: () => ({ activeKey: null, activeContext: null, gyms: [] }),

  getters: {
    active: (s) => s.gyms.find((g) => g.key === s.activeKey) || null,
    hasMultiple: (s) => s.gyms.length > 1,
  },

  actions: {
    setGyms(gyms) { this.gyms = gyms || [] },
    setActive(key) { this.activeKey = key },
    // Contexto elegido (backoffice/student/…) — un gym puede otorgar varios.
    setActiveContext(context) { this.activeContext = context },
    reset() { this.activeKey = null; this.activeContext = null; this.gyms = [] },
  },

  persist: {
    // Key + contexto activos sobreviven el refresh; la lista se recarga del backend.
    pick: ['activeKey', 'activeContext'],
  },
})
