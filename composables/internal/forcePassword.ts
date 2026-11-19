// Cambio de contraseña forzado (force_password_change) para backoffice y otras áreas.
// Lógica pura del middleware 06.force-password.global (la usan también los tests).
//
// appConfig.innertia.forcePassword = {
//   enabled: true,
//   routes: { '/backoffice': '/backoffice/auth/change-password' },   // prefijo → página de cambio
//   allow: ['/backoffice/auth/'],                                     // prefijos que siempre pasan
// }
// /platform ya lo cubre 05.platform-password.global (identidad de plataforma).

export interface ForcePasswordConfig {
  enabled?: boolean
  routes?: Record<string, string>
  allow?: string[]
}

export const FORCE_PASSWORD_DEFAULT_ROUTES: Record<string, string> = {
  '/backoffice': '/backoffice/auth/change-password',
}

/** Ruta a la que hay que redirigir, o null si se deja pasar. */
export function resolveForcePasswordRedirect(path: string, user: any, config?: ForcePasswordConfig | null): string | null {
  if (!config?.enabled || user?.force_password_change !== true) return null
  if (user?.is_platform_admin && path.startsWith('/platform')) return null

  const routes = config.routes && Object.keys(config.routes).length ? config.routes : FORCE_PASSWORD_DEFAULT_ROUTES
  const allow = config.allow ?? Object.keys(routes).map(prefix => `${prefix.replace(/\/+$/, '')}/auth/`)

  if (allow.some(prefix => path.startsWith(prefix))) return null

  // El prefijo más largo gana (p. ej. /backoffice/admin antes que /backoffice).
  const match = Object.keys(routes)
    .sort((a, b) => b.length - a.length)
    .find(prefix => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))

  if (!match) return null
  const target = routes[match]
  return path === target ? null : target
}
