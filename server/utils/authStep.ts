import { readBody, createError, getRequestHeader, type H3Event } from 'h3'
import { writeSession } from './session'
import { forwardClientHeaders } from './bff'
import { normalizeLoginResponse } from './login'

/**
 * Paso pre-auth del login (verificar OTP, cambio de clave forzado): reenvía a
 * Laravel server-to-server y, si responde token, sella la sesión igual que
 * /_auth/login. Devuelve el body SIN token (o el siguiente paso pendiente).
 */
export async function forwardAuthStep(event: H3Event, laravelPath: string, payload: Record<string, unknown>, context: string) {
  const config = useRuntimeConfig(event)
  let data: any
  try {
    data = await $fetch(`${config.apiInternalUrl}/${laravelPath}`, {
      method: 'POST',
      body: payload,
      headers: { Accept: 'application/json', ...forwardClientHeaders(n => getRequestHeader(event, n)) },
    })
  } catch (err: any) {
    const status = err?.response?.status ?? err?.statusCode ?? 500
    const msg = status === 429
      ? 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'
      : (err?.data?.errors && Object.values(err.data.errors).flat()[0]) || err?.data?.message || 'No se pudo completar el paso.'
    throw createError({ statusCode: status, data: err?.data ?? null, statusMessage: 'auth_step_failed', message: String(msg) })
  }
  const { token, body } = normalizeLoginResponse(data)
  if (token) await writeSession(event, { token, currentContext: context })
  return body
}

