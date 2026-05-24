import { defineStore } from 'pinia'

/**
 * Store de organizaciones (sub-tenant scoping).
 *
 * Model:
 *   - `available` es un Record<context, Organization[]> — lo que el backend devuelve
 *     en auth/me. Cada contexto puede tener su propia lista de orgs accesibles.
 *   - `currentByContext` es Record<context, string> — slug de la org elegida por
 *     contexto. Persiste en cookie 30d para retomar al volver.
 *
 * Org shape: { id, key (slug), name }
 *
 * Persistencia:
 *   - `currentByContext` en cookie 'innertia_org_by_ctx' (30d, SSR-leíble)
 *   - `available` NO se persiste — viene fresco de auth/me en cada boot
 */
export const useOrganizationStore = defineStore('organization', {
  state: () => ({
    /** @type {Record<string, Array<{ id: number, key: string, name: string }>>} */
    available: {},
    /** @type {Record<string, string>} */
    currentByContext: {},
    /** @type {boolean} — toggle global de vista consolidada (X-Consolidated header) */
    consolidated: false,
  }),

  persist: [
    {
      key: 'innertia_org_by_ctx',
      pick: ['currentByContext'],
      storage: piniaPluginPersistedstate.cookies,
      cookieOptions: { maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' },
    },
  ],

  getters: {
    /** Orgs accesibles para un contexto dado. */
    availableFor: (state) => (context) => state.available[context] ?? [],

    /** Slug de la org actual para un contexto. */
    currentFor: (state) => (context) => state.currentByContext[context] ?? null,

    /** Org actual completa (object) para un contexto. */
    currentObjectFor() {
      return (context) => {
        const slug = this.currentFor(context)
        if (!slug) return null
        return this.availableFor(context).find(o => o.key === slug) ?? null
      }
    },

    /** ¿Necesita mostrar picker para este contexto? */
    needsPickerFor() {
      return (context) => {
        const list = this.availableFor(context)
        const current = this.currentFor(context)
        if (list.length === 0) return false   // sin acceso — caso aparte
        if (list.length === 1) return false   // auto-select, no necesita picker
        if (current && list.some(o => o.key === current)) return false
        return true
      }
    },
  },

  actions: {
    /** Reemplaza la lista de orgs por contexto (típicamente llamado desde fetchMe). */
    setAvailable(byContext) {
      this.available = byContext ?? {}
      // Limpia currentByContext de slugs que ya no son accesibles
      const cleaned = {}
      for (const [ctx, slug] of Object.entries(this.currentByContext)) {
        const list = this.available[ctx] ?? []
        if (list.some(o => o.key === slug)) cleaned[ctx] = slug
      }
      this.currentByContext = cleaned
    },

    /** Setea la org actual para un contexto. */
    setCurrent(context, slug) {
      this.currentByContext = { ...this.currentByContext, [context]: slug }
    },

    /** Auto-select: si hay 1 sola org en el contexto y no está seteada, la selecciona. */
    autoSelectFor(context) {
      const list = this.availableFor(context)
      const current = this.currentFor(context)
      if (list.length === 1 && current !== list[0].key) {
        this.setCurrent(context, list[0].key)
      }
    },

    /** Toggle vista consolidada. */
    toggleConsolidated() {
      this.consolidated = !this.consolidated
    },

    setConsolidated(value) {
      this.consolidated = !!value
    },

    /** Cleanup en logout. */
    reset() {
      this.available = {}
      this.currentByContext = {}
      this.consolidated = false
    },
  },
})
