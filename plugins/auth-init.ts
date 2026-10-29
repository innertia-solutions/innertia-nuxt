// Universal (server+client). Rehidrata la sesión sin tocar el token (vive en la
// cookie sellada, solo accesible por el BFF).
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  const api = useApi()
  try {
    const session = await $fetch('/_auth/session')
    if (!session?.authenticated) { authStore.setAuthenticated(false); return }
    authStore.setAuthenticated(true)
    if (session.currentContext) authStore.currentContext = session.currentContext
    if (!authStore.user) {
      const me = await api.get('auth/me')
      if (me) {
        authStore.saveUser(me.user ?? me)
        authStore.savePermissions(me.permissions ?? [])
        authStore.availableContexts = me.availableContexts ?? me.contexts ?? []
      }
    }
  } catch {
    authStore.setAuthenticated(false)
  }
})
