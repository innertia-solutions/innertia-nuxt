import { defineEventHandler, readBody, createError } from 'h3'
import { readSession, writeSession } from '../../utils/session'
import { latestSessionToken } from '../../utils/sessionToken'

// Cambia el contexto activo en la sesión (el modal "¿seguro?" es UX de front).
export default defineEventHandler(async (event) => {
  const { context } = await readBody(event)
  const current = await readSession(event)
  if (!current.token) throw createError({ statusCode: 401, statusMessage: 'no_session' })
  // Con el token vigente: si se renovó hace poco, no reescribir la cookie con el viejo.
  await writeSession(event, { ...current, token: latestSessionToken(current.token), currentContext: context })
  return { ok: true, currentContext: context }
})
