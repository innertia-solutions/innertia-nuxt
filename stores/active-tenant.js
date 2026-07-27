import { defineStore } from 'pinia'

/**
 * Tenant activo en modo 'open'.
 * A diferencia de saas (tenant por subdominio), open resuelve el tenant por
 * selección in-app: el usuario elige entre sus tenants y esa key viaja como X-Tenant.
 * tenants: [{ key, name, status, contexts }]
 */
export const useActiveTenantStore = defineStore('activeTenant', {
  state: () => ({ activeKey: null, activeContext: null, tenants: [] }),

  getters: {
    active: (s) => s.tenants.find((t) => t.key === s.activeKey) || null,
    hasMultiple: (s) => s.tenants.length > 1,
  },

  actions: {
    setTenants(tenants) { this.tenants = tenants || [] },
    setActive(key) { this.activeKey = key },
    setActiveContext(context) { this.activeContext = context },
    reset() { this.activeKey = null; this.activeContext = null; this.tenants = [] },
  },

  persist: {
    pick: ['activeKey', 'activeContext'],
  },
})
