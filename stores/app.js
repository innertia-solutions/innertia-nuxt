import { defineStore } from 'pinia'

// Estado de la app (modo single-tenant). Poblado por el middleware 04.app-status
// desde GET /status. Equivalente app-mode del tenantStore de saas.
export const useAppStore = defineStore('app', {
  state: () => ({
    branding: {},          // { name }
    features: {},          // { organizations, teams, oauth }
    demo: null,            // { email, password } | null
  }),
  actions: {
    setStatus(status) {
      this.branding = status?.branding ?? {}
      this.features = status?.features ?? {}
      this.demo     = status?.branding?.demo ?? null
    },
  },
})
