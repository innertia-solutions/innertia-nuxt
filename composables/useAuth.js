// useAuthStore, useApi, useOrganizationStore, useInnertiaMode, useTenantSelection, useActiveTenantStore auto-imported

export function useAuth() {
  const authStore = useAuthStore()
  const organizationStore = useOrganizationStore()
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
    // Sella la sesión en el server (Nitro). Devuelve user+contexts, SIN token.
    const data = await $fetch('/_auth/login', {
      method: 'POST',
      body: { context, email, password, remember },
    })
    authStore.setAuthenticated(true)
    if (data.user) authStore.saveUser(data.user)
    authStore.setCurrentContext(context)
    queryClient.clear()
    await fetchMe()

    // En modo 'open' el tenant se resuelve por selección: cargamos los tenants del
    // usuario y devolvemos un destino (0/1/2+). saas/app conservan su return.
    if (useInnertiaMode().isOpen()) {
      const { resolveAfterLogin } = useTenantSelection()
      const tenantDestination = await resolveAfterLogin() // 'onboarding' | 'ready' | 'picker'
      return { ...(data ?? {}), tenantDestination }
    }

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

    // Hidratar organizaciones accesibles por contexto (si el backend las devuelve).
    // Shape esperado: { backoffice: [{ id, key, name }], technician: [...] }
    if (data.organizations) {
      organizationStore.setAvailable(data.organizations)
      // Auto-select para contextos donde el user tiene 1 sola org
      for (const ctx of Object.keys(data.organizations)) {
        organizationStore.autoSelectFor(ctx)
      }
    }

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
    try { await $fetch('/_auth/logout', { method: 'POST' }) } catch { /* best-effort */ }
    queryClient.clear()
    authStore.logout() // limpia el state en memoria
    organizationStore.reset()
    // En open, limpiar también el tenant seleccionado
    if (useInnertiaMode().isOpen()) useActiveTenantStore().reset()
    await navigateTo(loginPath)
  }

  /**
   * Get the OAuth redirect URL for a provider.
   * Returns the URL string from the backend.
   */
  async function getOauthRedirectUrl(context, provider) {
    // Laravel arma la URL de Google, pero el redirect_uri debe volver a la ruta
    // Nitro que sella la sesión: /_auth/{provider}/callback
    const redirectUri = `${window.location.origin}/_auth/${provider}/callback?context=${context}`
    const data = await api.get(`auth/${provider}/redirect`, { params: { context, redirect_uri: redirectUri } })
    return data.url ?? data
  }

  return { performLogin, fetchMe, logout, getOauthRedirectUrl }
}
