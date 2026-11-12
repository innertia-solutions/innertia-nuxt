// Renovación deslizante del JWT de la sesión sellada (lógica pura, sin h3).
//
// Laravel emite el JWT con un TTL fijo (config/jwt.php, default 60 min) y solo deja
// refrescarlo mientras siga vigente (POST auth/refresh invalida el token viejo y
// devuelve uno nuevo). Sin renovación, una sesión con uso activo moría al minuto 60
// y el siguiente "Guardar" terminaba en 401 → login, perdiendo lo escrito.
// El BFF renueva el token cuando le queda poco, mientras el usuario sigue activo.

export interface JwtPayload {
  exp?: number
  iat?: number
  nbf?: number
  platform?: boolean
  [key: string]: unknown
}

/** Decodifica el payload del JWT SIN verificar la firma (solo para leer exp/iat). */
export function decodeJwtPayload(token?: string | null): JwtPayload | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = typeof atob === 'function'
      ? new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0)))
      : Buffer.from(padded, 'base64').toString('utf8')
    const payload = JSON.parse(json)
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

/** Ventana máxima (segundos) antes del vencimiento en que se renueva. */
export const REFRESH_WINDOW_SECONDS = 10 * 60

/**
 * ¿Conviene renovar ahora? Sí cuando el token sigue vigente y le queda menos de
 * min(10 min, 1/3 de su vida). El tope por vida evita renovar en cada request si
 * el TTL configurado es corto. Los tokens de plataforma (claim `platform`) NO se
 * renuevan: auth/refresh de Laravel resuelve el usuario con el modelo de usuarios
 * del producto y no conserva el claim, así que emitiría un token de otra identidad.
 */
export function shouldRefreshToken(token: string | null | undefined, nowSeconds: number, windowSeconds = REFRESH_WINDOW_SECONDS): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return false
  if (payload.platform) return false
  const remaining = payload.exp - nowSeconds
  if (remaining <= 0) return false
  const issuedAt = typeof payload.iat === 'number' ? payload.iat : (typeof payload.nbf === 'number' ? payload.nbf : null)
  const lifetime = issuedAt !== null ? payload.exp - issuedAt : null
  const threshold = lifetime && lifetime > 0 ? Math.min(windowSeconds, lifetime / 3) : windowSeconds
  return remaining < threshold
}

/**
 * Rotador con deduplicación. Laravel invalida el token viejo al refrescar, así que:
 * - requests en paralelo con el mismo token comparten UNA sola llamada a refresh;
 * - requests que llegan con el token viejo poco después (el browser aún no recibió
 *   la cookie nueva) reciben el token nuevo desde una caché corta, en vez de 401.
 */
export function createTokenRotator<C = unknown>(opts: {
  refresh: (token: string, ctx?: C) => Promise<string | null>
  graceMs?: number
  /** Tras un refresh fallido, no reintentar con ese token durante este lapso. */
  failureBackoffMs?: number
  now?: () => number
}) {
  const graceMs = opts.graceMs ?? 2 * 60 * 1000
  const failureBackoffMs = opts.failureBackoffMs ?? 30 * 1000
  const now = opts.now ?? (() => Date.now())
  const inflight = new Map<string, Promise<string | null>>()
  const rotated = new Map<string, { token: string, at: number }>()
  // Refrescos fallidos recientes (endpoint inexistente, sesión revocada, Laravel
  // caído): sin esto, CADA request de la ventana final repetiría la llamada.
  const failed = new Map<string, number>()

  function prune() {
    const limit = now() - graceMs
    for (const [old, entry] of rotated) {
      if (entry.at < limit) rotated.delete(old)
    }
    const failLimit = now() - failureBackoffMs
    for (const [tok, at] of failed) {
      if (at < failLimit) failed.delete(tok)
    }
  }

  /** Token nuevo si este ya fue rotado hace poco (si no, null). */
  function rotatedFrom(token: string): string | null {
    const entry = rotated.get(token)
    if (!entry) return null
    if (entry.at < now() - graceMs) { rotated.delete(token); return null }
    return entry.token
  }

  /** Renueva (o reutiliza la renovación en curso/reciente). Null si no se pudo. */
  async function rotate(token: string, ctx?: C): Promise<string | null> {
    const done = rotatedFrom(token)
    if (done) return done
    const running = inflight.get(token)
    if (running) return running
    const failedAt = failed.get(token)
    if (failedAt !== undefined && failedAt >= now() - failureBackoffMs) return null
    const p = (async () => {
      try {
        const fresh = await opts.refresh(token, ctx)
        prune()
        if (fresh && fresh !== token) {
          rotated.set(token, { token: fresh, at: now() })
          return fresh
        }
        failed.set(token, now())
        return null
      } catch {
        prune()
        failed.set(token, now())
        return null
      } finally {
        inflight.delete(token)
      }
    })()
    inflight.set(token, p)
    return p
  }

  return { rotate, rotatedFrom }
}
