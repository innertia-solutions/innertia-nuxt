import { defineEventHandler, proxyRequest, getRequestURL } from 'h3'
import { clearSession } from '../../utils/session'
import { resolveApiTarget, buildAuthHeaders } from '../../utils/bff'
import { resolveSessionToken, persistRotatedSession } from '../../utils/sessionToken'

// BFF: reenvía /api/** a Laravel inyectando el Bearer desde la sesión sellada.
// proxyRequest hace passthrough de método/body/headers y STREAMEA la respuesta
// (crítico para el SSE del asistente). No se reenvía la cookie de sesión.
// El token se renueva si está por vencer (ver server/utils/sessionToken.ts).
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const token = await resolveSessionToken(event)
  const path = (event.context.params?.path ?? '') as string
  const search = getRequestURL(event).search
  const target = resolveApiTarget(config.apiInternalUrl, path, search)
  return proxyRequest(event, target, {
    headers: buildAuthHeaders(token),
    onResponse: async (ev, response) => {
      // Token rechazado por Laravel → la sesión sellada no sirve: borrarla para que
      // /_auth/session deje de reportar authenticated (evita loops de redirección).
      if (token && response.status === 401) return clearSession(ev)
      // Token renovado en este request → reescribir la cookie (después de copiar
      // los headers de Laravel, que pisarían nuestro Set-Cookie).
      await persistRotatedSession(ev)
    },
  })
})
