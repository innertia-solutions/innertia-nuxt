import { readSession } from '../utils/session'

// Lee la sesión sellada una vez por request y deja el token en event.context
// para que useApi (SSR) adjunte el Bearer en llamadas directas a Laravel.
// Defensivo: si no hay secret/sesión, sigue sin token (no revienta el request).
export default defineEventHandler(async (event) => {
  try {
    const { token } = await readSession(event)
    if (token) event.context.authToken = token
  } catch {
    // sin NUXT_SESSION_PASSWORD o sin sesión válida → seguir sin token
  }
})
