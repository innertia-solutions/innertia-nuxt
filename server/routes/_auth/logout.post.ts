import { defineEventHandler } from 'h3'
import { readSession, clearSession } from '../../utils/session'
import { buildAuthHeaders } from '../../utils/bff'
import { latestSessionToken } from '../../utils/sessionToken'

// Best-effort: avisa a Laravel con el Bearer de la sesión, luego limpia la sesión.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  // Si el token se renovó hace poco y el browser aún manda el viejo, cerrar el nuevo.
  const token = latestSessionToken((await readSession(event)).token)
  if (token) {
    try {
      await $fetch(`${config.apiInternalUrl}/auth/logout`, {
        method: 'POST', headers: { ...buildAuthHeaders(token), Accept: 'application/json' },
      })
    } catch { /* best-effort */ }
  }
  await clearSession(event)
  return { ok: true }
})
