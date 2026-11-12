import { getRequestHeader } from 'h3'
import type { H3Event } from 'h3'
import { readSession, writeSession } from './session'
import type { SessionData } from './session'
import { buildAuthHeaders, forwardClientHeaders } from './bff'
import { createTokenRotator, shouldRefreshToken } from './tokenRefresh'

// Token de la sesión sellada con renovación deslizante (ver tokenRefresh.ts).
// Un rotador por proceso Nitro: deduplica refrescos concurrentes del mismo token.
let rotator: ReturnType<typeof createTokenRotator<H3Event>> | null = null

function getRotator() {
  if (!rotator) {
    rotator = createTokenRotator<H3Event>({
      refresh: async (token, ev) => {
        if (!ev) return null
        const config = useRuntimeConfig(ev)
        const path = String((config as any).authRefresh?.path || 'auth/refresh').replace(/^\/+/, '')
        const res: any = await $fetch(`${String(config.apiInternalUrl).replace(/\/+$/, '')}/${path}`, {
          method: 'POST',
          // Un refresh colgado no debe bloquear el request del usuario: se sigue con el token actual.
          timeout: 5000,
          headers: {
            ...buildAuthHeaders(token),
            Accept: 'application/json',
            ...forwardClientHeaders(n => getRequestHeader(ev, n)),
          },
        })
        return typeof res?.token === 'string' ? res.token : null
      },
    })
  }
  return rotator
}

/**
 * Devuelve el token vigente de la sesión del request, renovándolo si está por
 * vencer. Si se renovó, deja la sesión nueva pendiente en event.context para que
 * se escriba la cookie con `persistRotatedSession` (en el momento adecuado: el
 * proxy la escribe después de copiar los headers de Laravel, que pisarían el
 * Set-Cookie). Se resuelve una sola vez por request.
 */
export async function resolveSessionToken(event: H3Event): Promise<string | undefined> {
  const ctx = event.context as any
  if (ctx.innertiaTokenResolved) return ctx.innertiaToken
  ctx.innertiaTokenResolved = true

  const session: SessionData = await readSession(event)
  let token = session.token
  if (!token) return (ctx.innertiaToken = undefined)

  const r = getRotator()
  // Token recién rotado por otro request en paralelo → usar el nuevo.
  let fresh = r.rotatedFrom(token)
  const enabled = (useRuntimeConfig(event) as any).authRefresh?.enabled !== false
  if (!fresh && enabled && shouldRefreshToken(token, Math.floor(Date.now() / 1000))) {
    try { fresh = await r.rotate(token, event) } catch { fresh = null }
  }
  if (fresh && fresh !== token) {
    token = fresh
    ctx.innertiaPendingSession = { ...session, token: fresh }
  }
  return (ctx.innertiaToken = token)
}

/** Escribe la cookie sellada con el token renovado, si hubo renovación en este request. */
export async function persistRotatedSession(event: H3Event): Promise<void> {
  const ctx = event.context as any
  const pending: SessionData | undefined = ctx.innertiaPendingSession
  if (!pending) return
  ctx.innertiaPendingSession = undefined
  try { await writeSession(event, pending) } catch { /* sin secret: seguir sin reescribir */ }
}

/**
 * Token más reciente para un token de cookie: si fue rotado hace poco (el browser
 * todavía manda la cookie vieja), devuelve el nuevo. Lo usan logout/contexto para
 * no operar sobre un token que Laravel ya invalidó al refrescar.
 */
export function latestSessionToken(token?: string): string | undefined {
  if (!token || !rotator) return token
  return rotator.rotatedFrom(token) ?? token
}
