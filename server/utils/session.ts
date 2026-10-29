import { useSession } from 'h3'
import type { H3Event } from 'h3'

export const SESSION_COOKIE = 'innertia_session'

export interface SessionData {
  token?: string
  currentContext?: string
}

/** Opciones de la sesión sellada. Pura y testeable. */
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

// Secure cookie en qa/prod (HTTPS); en dev local (http) debe ir sin Secure o el
// browser la descarta silenciosamente → logout loop.
function secureCookie(): boolean {
  return process.env.NODE_ENV !== 'development'
}

function password(event: H3Event): string {
  // runtimeConfig.session.password (privado), llenado desde NUXT_SESSION_PASSWORD.
  return useRuntimeConfig(event).session.password
}

export async function readSession(event: H3Event): Promise<SessionData> {
  const s = await useSession<SessionData>(event, sessionOptions(password(event), { secure: secureCookie() }))
  return s.data
}

export async function writeSession(event: H3Event, data: SessionData): Promise<void> {
  const s = await useSession<SessionData>(event, sessionOptions(password(event), { secure: secureCookie() }))
  await s.update(data)
}

export async function clearSession(event: H3Event): Promise<void> {
  const s = await useSession<SessionData>(event, sessionOptions(password(event), { secure: secureCookie() }))
  await s.clear()
}
