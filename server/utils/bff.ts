// Lógica pura del BFF. Sin dependencias de h3 para poder testear aislado.

/** Construye la URL destino en Laravel: base + /api/ + path + query. */
export function resolveApiTarget(base: string, path: string, search: string): string {
  const cleanBase = base.replace(/\/+$/, '')
  return `${cleanBase}/api/${path}${search}`
}

/**
 * Headers a inyectar al reenviar a Laravel:
 * - Authorization Bearer si hay token de sesión.
 * - cookie vacía: NO reenviar la cookie de sesión de Nitro al backend.
 */
export function buildAuthHeaders(token?: string): Record<string, string> {
  return token ? { authorization: `Bearer ${token}`, cookie: '' } : { cookie: '' }
}
