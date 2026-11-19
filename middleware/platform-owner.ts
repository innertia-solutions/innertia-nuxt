// Secciones de /platform solo para el owner (configuración de correo, respaldos…). El backend
// responde 403 a staff (middleware platform.owner de innertia-laravel); esto evita mostrar
// formularios que van a fallar. Uso: definePageMeta({ middleware: ['platform-owner'] }).
// Un producto con su propio `platform-owner` lo reemplaza (el del producto tiene prioridad).
export default defineNuxtRouteMiddleware(() => {
  const user = useAuthStore().user as any

  if (user?.platform_role !== 'owner') {
    if (import.meta.client) useToast().error('Solo el owner de la plataforma puede acceder a esta sección.')
    return navigateTo('/platform')
  }
})
