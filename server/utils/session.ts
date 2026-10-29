import { getCookie, setCookie, deleteCookie } from 'h3'
import type { H3Event } from 'h3'
import { seal, unseal, defaults as ironDefaults } from 'iron-webcrypto'

// Sesión httpOnly sellada con iron (el token nunca llega al JS del browser).
//
// IMPORTANTE: NO usamos `useSession` de h3. Su `getSession` bajo la concurrencia de
// Nitro devolvía sesión vacía en ~60% de requests paralelos y, peor, REESCRIBÍA la
// cookie vacía cuando el unseal fallaba (envenenaba la sesión → logout aleatorio).
// iron (seal/unseal) es concurrency-safe por sí solo (probado 40× paralelo sin fallos);
// el bug vivía en la maquinaria de useSession. Acá hacemos lectura PURA: getCookie +
// unseal, sin tocar la cookie en fallo. Escritura explícita solo en login/logout/context.

export const SESSION_COOKIE = 'innertia_session'

export interface SessionData {
  token?: string
  currentContext?: string
}

/** Opciones de cookie sellada. `sessionOptions` se conserva para los tests (pura). */
export function sessionOptions(password: string, opts: { secure?: boolean } = {}) {
  if (!password || password.length < 32) {
    throw new Error('[innertia-auth] NUXT_SESSION_PASSWORD debe tener ≥32 caracteres')
  }
  return {
    password,
    name: SESSION_COOKIE,
    cookie: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: opts.secure ?? true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    },
  }
}

function password(event: H3Event): string {
  const p = useRuntimeConfig(event).session.password
  if (!p || p.length < 32) {
    throw new Error('[innertia-auth] NUXT_SESSION_PASSWORD debe tener ≥32 caracteres')
  }
  return p
}

// Secure en qa/prod (HTTPS); en dev local (http) sin Secure o el browser la descarta.
function secureCookie(): boolean {
  return process.env.NODE_ENV !== 'development'
}

/** Lectura PURA: getCookie + iron unseal. Nunca reescribe la cookie (ni en fallo). */
export async function readSession(event: H3Event): Promise<SessionData> {
  const raw = getCookie(event, SESSION_COOKIE)
  if (!raw) return {}
  try {
    const d = (await unseal(globalThis.crypto as Crypto, raw, password(event), ironDefaults)) as any
    if (!d || typeof d !== 'object') return {}
    // Compat: sesiones viejas selladas por useSession envuelven en {id,createdAt,data}.
    return (d.data && typeof d.data === 'object') ? d.data : d
  } catch {
    return {}
  }
}

/** Sella {token, currentContext} y setea la cookie httpOnly. */
export async function writeSession(event: H3Event, data: SessionData): Promise<void> {
  const sealed = await seal(globalThis.crypto as Crypto, data, password(event), ironDefaults)
  setCookie(event, SESSION_COOKIE, sealed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie(),
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearSession(event: H3Event): Promise<void> {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
