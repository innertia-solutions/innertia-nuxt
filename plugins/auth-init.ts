// Universal plugin: runs on both server (SSR) and client.
// On SSR: token is read from cookie → fetches user from API → pinia state is serialized
// into the Nuxt payload and transferred to the client → no hydration mismatch.
// Avoids useQueryClient() because vue-query.ts runs after this plugin alphabetically.
// Universal plugin: runs on both server (SSR) and client.
// On SSR: token is read from cookie → fetches user from API → pinia state is serialized
// into the Nuxt payload and transferred to the client → no hydration mismatch.
// Avoids useQueryClient() because vue-query.ts runs after this plugin alphabetically.
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()

  // Use getToken() not authStore.token — pinia-plugin-persistedstate may not have
  // hydrated the store yet in SSR, but getToken() reads useCookie() directly.
  if (!authStore.getToken()) return

  if (!authStore.isAuthenticated()) {
    authStore.logout()
    return
  }

  if (!authStore.user) {
    try {
      const api = useApi()
      const data = await api.get('auth/me')
      if (data) {
        authStore.saveUser(data.user ?? data)
        authStore.savePermissions(data.permissions ?? [])
        authStore.availableContexts = data.availableContexts ?? []
      }
    } catch {
      if (import.meta.client) authStore.logout()
    }
  }
})
