import { defineStore } from 'pinia'

// ─── cookie helpers ────────────────────────────────────────────────────────
// Never call useCookie() inside Pinia actions — it throws outside Vue setup.
// Pattern: try useCookie (works in setup), catch → document.cookie fallback.

function _setCookie(name, value, maxAgeSeconds) {
  try {
    const isDev = import.meta.env?.DEV ?? false
    const cookie = useCookie(name, { maxAge: maxAgeSeconds, sameSite: 'lax', secure: !isDev })
    cookie.value = typeof value === 'object' ? JSON.stringify(value) : value
  } catch {
    if (import.meta.client) {
      const expires = maxAgeSeconds ? `; Max-Age=${Math.floor(maxAgeSeconds)}` : ''
      const val = typeof value === 'object' ? JSON.stringify(value) : value
      document.cookie = `${name}=${encodeURIComponent(val)}${expires}; path=/; SameSite=Lax`
    }
  }
}

function _deleteCookie(name) {
  try {
    const cookie = useCookie(name)
    cookie.value = null
  } catch {
    if (import.meta.client) {
      document.cookie = `${name}=; Max-Age=0; path=/`
    }
  }
}

// ─── store ─────────────────────────────────────────────────────────────────
export const useAuthStore = defineStore('auth', {
  state: () => ({
    authenticated: false,
    user: null,
    currentContext: null,
    availableContexts: [],
    permissions: [],
    rememberUser: false,
  }),

  persist: [
    {
      // currentContext y availableContexts en localStorage.
      // user NO se persiste: auth-init.client.ts lo recarga desde API en cada boot,
      // evitando que un user:null guardado en localStorage sobreescriba el estado.
      key: 'auth_data',
      pick: ['currentContext', 'availableContexts'],
      storage: piniaPluginPersistedstate.localStorage,
    },
  ],

  actions: {
    // ── auth flag ──────────────────────────────────────────────────────────
    // El token ya no vive en el cliente. isAuthenticated se resuelve por /_auth/session.
    setAuthenticated(value) {
      this.authenticated = !!value
    },
    isAuthenticated() {
      return this.authenticated === true
    },

    // ── user ───────────────────────────────────────────────────────────────
    saveUser(user) {
      this.user = user
      _setCookie('auth_user', user, 60 * 60 * 24 * 7)
    },

    // ── context ────────────────────────────────────────────────────────────
    setCurrentContext(context) {
      this.currentContext = context
    },

    // ── permissions ────────────────────────────────────────────────────────
    savePermissions(permissions) {
      this.permissions = permissions ?? []
    },

    // ── logout ─────────────────────────────────────────────────────────────
    logout() {
      this.authenticated = false
      this.user = null
      this.currentContext = null
      this.availableContexts = []
      this.permissions = []
      _deleteCookie('auth_user')
    },
  },
})
