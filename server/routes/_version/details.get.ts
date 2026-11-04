import { defineEventHandler, setResponseHeader, setResponseStatus } from 'h3'
import { readSession } from '../../utils/session'
import { resolveApiTarget, buildAuthHeaders } from '../../utils/bff'
import { frontendDetails } from '../../utils/version'

// Detalle (front + back). Nitro no sabe quién es platform admin: delega la
// autorización al backend llamando su endpoint protegido con el Bearer de la sesión.
// ≠2xx → mismo status, sin datos del front. 2xx → { frontend, backend }.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const config = useRuntimeConfig(event)
  const cfg = config.innertiaVersion ?? {}
  const { token } = await readSession(event)

  if (!token) {
    setResponseStatus(event, 401)
    return { message: 'No autenticado.' }
  }

  const target = resolveApiTarget(config.apiInternalUrl, cfg.detailsPath || 'platform/version', '')
  const res = await $fetch.raw(target, {
    headers: { ...buildAuthHeaders(token), accept: 'application/json' },
    ignoreResponseError: true,
  }).catch(() => null)

  if (!res) {
    setResponseStatus(event, 502)
    return { message: 'Backend no disponible.' }
  }
  if (res.status < 200 || res.status >= 300) {
    setResponseStatus(event, res.status)
    return { message: (res._data as any)?.message ?? 'No autorizado.' }
  }

  return {
    frontend: frontendDetails(cfg, process.env, process.version),
    backend: res._data,
  }
})
