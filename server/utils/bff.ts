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
