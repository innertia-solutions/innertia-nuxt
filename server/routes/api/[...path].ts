import { defineEventHandler, proxyRequest, getRequestURL } from 'h3'
import { readSession } from '../../utils/session'
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
  return proxyRequest(event, target, { headers: buildAuthHeaders(token) })
})
