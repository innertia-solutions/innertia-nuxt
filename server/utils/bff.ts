// Lógica pura del BFF. Sin dependencias de h3 para poder testear aislado.

/**
 * Construye la URL destino en Laravel: base + path + query.
 * El prefijo `/api` del front es solo el punto de montaje del BFF; Laravel sirve
 * en root (el proxy viejo `/api/** → http://api:80/**` también stripeaba el /api).
 */
export function resolveApiTarget(base: string, path: string, search: string): string {
  const cleanBase = base.replace(/\/+$/, '')
  return `${cleanBase}/${path}${search}`
}

/**
 * Headers a inyectar al reenviar a Laravel:
 * - Authorization Bearer si hay token de sesión.
 * - cookie vacía: NO reenviar la cookie de sesión de Nitro al backend.
 */
export function buildAuthHeaders(token?: string): Record<string, string> {
  return token ? { authorization: `Bearer ${token}`, cookie: '' } : { cookie: '' }
}

/** Headers del cliente que Laravel necesita para conocer su IP real y dispositivo. */
const CLIENT_HEADERS = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'user-agent'] as const

/**
 * Headers del cliente original a reenviar en las llamadas server-to-server
 * (login, login de plataforma, callback OAuth, logout). Sin esto Laravel ve a
 * TODOS los usuarios con la IP del contenedor Nuxt: el throttle de login queda
 * compartido entre todos (un atacante bloquea el login de todos) y las
 * sesiones quedan sin IP ni dispositivo. Recibe un getter para no depender de h3.
 */
export function forwardClientHeaders(get: (name: string) => string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of CLIENT_HEADERS) {
    const value = get(name)
    if (value) out[name] = value
  }
  return out
}
