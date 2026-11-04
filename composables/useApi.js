// useRequestInterceptors auto-imported from nuxt-core
import { deleteCookie } from 'h3'
// useAuthStore auto-imported from this package

export function useApi() {
  const config = useRuntimeConfig()
  // On the server, use the private internal URL (e.g. http://api:80) because relative URLs
  // don't resolve in Node.js. On the client, use the public apiBaseUrl (/api proxy).
  const baseUrl = import.meta.server
    ? (config.apiInternalUrl || config.public.apiBaseUrl || '/api')
    : (config.public.apiBaseUrl || '/api')
  const loginPath = config.public.loginPath || '/login'
  // Capturados en setup (contexto Nuxt síncrono): tras un await en makeRequest
  // el contexto puede no estar disponible.
  const requestEvent = import.meta.server ? useRequestEvent() : null
  const router = import.meta.client ? useRouter() : null

  const { run, add } = useRequestInterceptors()

  function serializeParams(obj, prefix = '') {
    const parts = []
    for (const [key, val] of Object.entries(obj)) {
      if (val === null || val === undefined) continue
      const fullKey = prefix ? `${prefix}[${key}]` : key
      if (Array.isArray(val)) {
        val.forEach((item, i) => {
          if (item !== null && typeof item === 'object') {
            parts.push(...serializeParams(item, `${fullKey}[${i}]`).split('&').filter(Boolean))
          } else {
            parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(item)}`)
          }
        })
      } else if (typeof val === 'object') {
        parts.push(serializeParams(val, fullKey))
      } else {
        parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(val)}`)
      }
    }
    return parts.join('&')
  }

  async function makeRequest(method, path, body = null, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Innertia-Source': import.meta.server ? 'ssr' : 'client',
    }
    run(headers, options)

    // SSR: adjuntar el Bearer desde la sesión sellada del request activo
    // (el BFF no interviene en llamadas server-side directas a Laravel).
    if (import.meta.server) {
      const event = useRequestEvent()
      const token = event?.context?.authToken
      if (token) headers['Authorization'] = `Bearer ${token}`
    }

    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    let url = `${baseUrl}/${cleanPath}`

    if (options.params && Object.keys(options.params).length) {
      const qs = serializeParams(options.params)
      if (qs) url += '?' + qs
    }

    const fetchOptions = { method, headers }
    if (body !== null) fetchOptions.body = JSON.stringify(body)

    const response = await fetch(url, fetchOptions)

    if (response.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
      // La sesión sellada quedó inválida (token revocado, usuario borrado, BD
      // reseteada): hay que BORRARLA. Si no, cada request vuelve "autenticado",
      // guest manda a home, auth/me da 401 y se redirige a login → loop infinito
      // (ERR_TOO_MANY_REDIRECTS).
      if (requestEvent) {
        requestEvent.context.authToken = undefined
        deleteCookie(requestEvent, 'innertia_session', { path: '/' })
      } else if (import.meta.client) {
        try { await $fetch('/_auth/logout', { method: 'POST' }) } catch { /* best-effort */ }
      }
      const current = requestEvent ? requestEvent.path?.split('?')[0] : router?.currentRoute.value.path
      // Ya en una página de login (la del producto o /platform/login): no redirigir.
      if (current !== loginPath && !current?.endsWith('/login')) await navigateTo(loginPath)
      return null
    }

    const contentType = response.headers.get('content-type') ?? ''
    const data = contentType.includes('application/json') ? await response.json() : await response.text()

    if (!response.ok) {
      const err = new Error(`API error ${response.status}`)
      err.status = response.status
      err.data = data
      throw err
    }

    return data
  }

  const get    = (path, options = {}) => makeRequest('GET',    path, null, options)
  const post   = (path, body, options = {}) => makeRequest('POST',   path, body, options)
  const put    = (path, body, options = {}) => makeRequest('PUT',    path, body, options)
  const patch  = (path, body, options = {}) => makeRequest('PATCH',  path, body, options)
  const del    = (path, options = {}) => makeRequest('DELETE', path, null, options)

  // *Sync aliases — same methods, named for clarity in call sites
  const getSync    = get
  const postSync   = post
  const putSync    = put
  const patchSync  = patch
  const deleteSync = del

  /** Shortcut to add an interceptor from a composable or plugin */
  const addInterceptor = (fn) => add(fn)

  return { get, post, put, patch, delete: del, getSync, postSync, putSync, patchSync, deleteSync, addInterceptor }
}
