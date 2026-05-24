// Redirect already-authenticated users away from guest-only pages (login, register).
// useAuthStore auto-imported from nuxt-app stores.
export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()
  if (authStore.isAuthenticated()) {
    return navigateTo(config.public.homePath || '/')
  }
})
