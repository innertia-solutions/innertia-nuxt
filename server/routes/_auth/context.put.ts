import { defineEventHandler, readBody, createError } from 'h3'
import { readSession, writeSession } from '../../utils/session'

// Cambia el contexto activo en la sesión (el modal "¿seguro?" es UX de front).
export default defineEventHandler(async (event) => {
  const { context } = await readBody(event)
  const current = await readSession(event)
  if (!current.token) throw createError({ statusCode: 401, statusMessage: 'no_session' })
  await writeSession(event, { ...current, currentContext: context })
  return { ok: true, currentContext: context }
})
