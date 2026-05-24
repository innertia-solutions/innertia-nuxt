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

function _getCookie(name) {
  try {
    const cookie = useCookie(name)
    return cookie.value ?? null
  } catch {
    if (import.meta.client) {
      const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
      return match ? decodeURIComponent(match[1]) : null
    }
    return null
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

// ─── JWT decode (no lib) ───────────────────────────────────────────────────
function _decodeJwtExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ?? null
  } catch {
    return null
  }
}

// ─── store ─────────────────────────────────────────────────────────────────
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null,
    user: null,
    currentContext: null,
    availableContexts: [],
    permissions: [],
    rememberUser: false,
  }),

  persist: [
    {
      // Token en cookie con key propio para que SSR lo lea en middlewares (guest/auth).
      // Key separado para evitar que la segunda config sobreescriba el token.
      key: 'auth_token',
      pick: ['token'],
      storage: piniaPluginPersistedstate.cookies,
    },
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
    // ── token ──────────────────────────────────────────────────────────────
    saveToken(token) {
      this.token = token
      _setCookie('auth_token', token, 60 * 60 * 24 * 7) // 7 days
    },

    getToken() {
      return this.token ?? _getCookie('auth_token')
    },

    isAuthenticated() {
      const token = this.getToken()
      if (!token) return false
      const exp = _decodeJwtExpiry(token)
      if (exp === null) return true // non-JWT or no expiry claim → treat as valid
      return Date.now() / 1000 < exp
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
      this.token = null
      this.user = null
      this.currentContext = null
      this.availableContexts = []
      this.permissions = []
      _deleteCookie('auth_token')
      _deleteCookie('auth_user')
    },
  },
})
