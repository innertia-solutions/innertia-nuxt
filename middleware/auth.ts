// Redirect unauthenticated users to login.
// useAuthStore auto-imported from nuxt-app stores.
export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()
  if (!authStore.isAuthenticated()) {
    return navigateTo(config.public.loginPath || '/login')
  }
})
