// Cuenta de plataforma con clave temporal (force_password_change): mientras no
// defina una nueva, cualquier ruta de /platform la lleva a /platform/change-password.
// Genérico para todos los productos (identidad de plataforma separada). El backend
// (Authenticate de innertia-laravel) bloquea igual la API con 403.
export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/platform')) return
  if (to.path === '/platform/login' || to.path === '/platform/change-password') return

  const user = useAuthStore().user as any
  if (user?.is_platform_admin && user?.force_password_change) {
    return navigateTo('/platform/change-password', { replace: true })
  }
})
