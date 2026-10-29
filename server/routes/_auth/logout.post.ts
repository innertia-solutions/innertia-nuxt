import { defineEventHandler } from 'h3'
import { readSession, clearSession } from '../../utils/session'
import { buildAuthHeaders } from '../../utils/bff'

// Best-effort: avisa a Laravel con el Bearer de la sesión, luego limpia la sesión.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const { token } = await readSession(event)
  if (token) {
    try {
      await $fetch(`${config.apiInternalUrl}/api/auth/logout`, {
        method: 'POST', headers: { ...buildAuthHeaders(token), Accept: 'application/json' },
      })
    } catch { /* best-effort */ }
  }
  await clearSession(event)
  return { ok: true }
})
