import { resolveForcePasswordRedirect } from '../composables/internal/forcePassword'

// Cambio de contraseña forzado (force_password_change) fuera de /platform: mientras el
// usuario no defina una nueva, cualquier ruta del área lo lleva a su página de cambio.
// Opt-in: no hace nada hasta que el producto declara appConfig.innertia.forcePassword.enabled.
//   appConfig: { innertia: { forcePassword: { enabled: true, routes: { '/backoffice': '/backoffice/auth/change-password' } } } }
// /platform lo cubre 05.platform-password.global.
export default defineNuxtRouteMiddleware((to) => {
  const config = (useAppConfig() as any).innertia?.forcePassword
  if (!config?.enabled) return

  const target = resolveForcePasswordRedirect(to.path, useAuthStore().user, config)
  if (target) return navigateTo(target, { replace: true })
})
