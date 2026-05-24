import { defineStore } from 'pinia'

export const useTenantStore = defineStore('tenant', {
  state: () => ({
    tenantId: null,
    tenantSlug: null,
    config: {
      oauthProviders: [],
      features: [],
      isActive: false,
      demo: null,
    },
  }),

  persist: {
    // tenantId y tenantSlug sobreviven el refresh; config siempre se recarga del backend
    pick: ['tenantId', 'tenantSlug'],
  },

  actions: {
    /** Llamado por el middleware detect-subdomain con el slug extraído */
    setSlug(slug) {
      this.tenantSlug = slug
    },

    /** Llamado tras la validación del backend — setea el id y la config completa */
    setTenant(id, config) {
      this.tenantId = id
      this.config = {
        oauthProviders: config.oauthProviders ?? [],
        features: config.features ?? [],
        isActive: config.isActive ?? false,
        demo: config.demo ?? null,
      }
    },

    /** Verifica si un feature flag está habilitado para este tenant */
    isFeatureEnabled(feature) {
      return this.config.features.includes(feature)
    },

    /** Devuelve los providers OAuth configurados para este tenant */
    getOauthProviders() {
      return this.config.oauthProviders ?? []
    },

    /** Resetea todo el estado del tenant (ej. logout o tenant inválido) */
    clear() {
      this.tenantId = null
      this.tenantSlug = null
      this.config = { oauthProviders: [], features: [], isActive: false, demo: null }
    },
  },
})
