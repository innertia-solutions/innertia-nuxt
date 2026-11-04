import { defineEventHandler, proxyRequest, getRequestURL } from 'h3'
import { readSession, clearSession } from '../../utils/session'
import { resolveApiTarget, buildAuthHeaders } from '../../utils/bff'

// BFF: reenvía /api/** a Laravel inyectando el Bearer desde la sesión sellada.
// proxyRequest hace passthrough de método/body/headers y STREAMEA la respuesta
// (crítico para el SSE del asistente). No se reenvía la cookie de sesión.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const { token } = await readSession(event)
  const path = (event.context.params?.path ?? '') as string
  const search = getRequestURL(event).search
  const target = resolveApiTarget(config.apiInternalUrl, path, search)
  return proxyRequest(event, target, {
    headers: buildAuthHeaders(token),
    // Token rechazado por Laravel → la sesión sellada no sirve: borrarla para que
    // /_auth/session deje de reportar authenticated (evita loops de redirección).
    onResponse: (ev, response) => {
      if (token && response.status === 401) clearSession(ev)
    },
  })
})
