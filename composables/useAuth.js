// useAuthStore, useApi auto-imported

export function useAuth() {
  const authStore = useAuthStore()
  const api = useApi()
  const config = useRuntimeConfig()
  const loginPath = config.public.loginPath || '/login'
  const queryClient = useQueryClient()

  /**
   * Standard login (email + password).
   * context: role/area slug used in the API path (e.g. 'admin', 'technician').
   */
  async function performLogin(context, email, password, remember = false) {
    authStore.rememberUser = remember
    const data = await api.post(`${context}/auth/login`, { email, password, app: context })
    authStore.saveToken(data.token ?? data.access_token)
    authStore.setCurrentContext(context)
    queryClient.clear()
    await fetchMe()
    return data
  }

  /**
   * Load current user, permissions, and available contexts from the API.
   * Called after login and after context switch.
   */
  async function fetchMe() {
    const data = await api.get('auth/me')
    if (!data) return null
    authStore.saveUser(data.user ?? data)
    authStore.savePermissions(data.permissions ?? [])
    authStore.availableContexts = data.availableContexts ?? []
    applyAppearance(data.preferences?.appearance)
    return data
  }

  function applyAppearance(appearance) {
    if (!appearance || !import.meta.client) return
    const dark = appearance === 'dark'
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('hs_theme', appearance)
    document.cookie = `hs_theme=${appearance};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
  }

  /**
   * Logout: best-effort POST to backend, then clear local state and redirect.
   */
  async function logout() {
    try {
      await api.post('auth/logout', {})
    } catch {
      // best-effort — ignore network failures
    }
    queryClient.clear()
    authStore.logout()
    await navigateTo(loginPath)
  }

  /**
   * Get the OAuth redirect URL for a provider.
   * Returns the URL string from the backend.
   */
  async function getOauthRedirectUrl(context, provider) {
    const data = await api.get(`${context}/auth/oauth/${provider}/redirect`)
    return data.url
  }

  /**
   * Handle OAuth callback. Same success path as performLogin.
   */
  async function handleOauthCallback(context, provider, code) {
    const data = await api.post(`${context}/auth/oauth/${provider}/callback`, { code })
    authStore.saveToken(data.token ?? data.access_token)
    authStore.setCurrentContext(context)
    queryClient.clear()
    await fetchMe()
    return data
  }

  return { performLogin, fetchMe, logout, getOauthRedirectUrl, handleOauthCallback }
}
