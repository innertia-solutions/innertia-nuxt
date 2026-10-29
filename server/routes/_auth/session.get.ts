import { defineEventHandler } from 'h3'
import { readSession } from '../../utils/session'

// Para SSR/middlewares: ¿hay sesión? ¿cuál es el contexto activo? Sin exponer el token.
export default defineEventHandler(async (event) => {
  const { token, currentContext } = await readSession(event)
  return { authenticated: !!token, currentContext: currentContext ?? null }
})
