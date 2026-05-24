/**
 * Descarga un archivo usando XHR con soporte de progreso.
 * Los headers de autenticación se inyectan automáticamente vía useRequestInterceptors.
 */
// useRequestInterceptors is auto-imported from nuxt-core composables
export function useDownload() {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiBaseUrl

  /**
   * @param {string} url - ruta relativa al baseUrl
   * @param {object} params - query params (GET) o body (POST)
   * @param {object} options - { onProgress, method, headers }
   *   `headers` es mezclado DESPUÉS de que corran los interceptores (el caller puede sobreescribir)
   * @returns {Promise<{ blob: Blob, headers: object }>}
   */
  function serializeParams(obj, prefix = '') {
    const parts = []
    for (const [key, val] of Object.entries(obj)) {
      if (val === null || val === undefined) continue
      const fullKey = prefix ? `${prefix}[${key}]` : key
      if (Array.isArray(val)) {
        val.forEach((item, i) => {
          if (item !== null && typeof item === 'object') {
            parts.push(serializeParams(item, `${fullKey}[${i}]`))
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
    return parts.filter(Boolean).join('&')
  }

  function download(url, params = {}, options = {}) {
    const {
      onProgress = null,
      method = 'GET',
      headers: extraHeaders = {},
    } = options

    // Run all interceptors (auth token, X-Tenant-Id, etc.)
    const { run } = useRequestInterceptors()
    const headers = {}
    run(headers, options)
    // Merge caller-supplied headers last (allow override)
    Object.assign(headers, extraHeaders)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      let query = ''
      if (method === 'GET' && Object.keys(params).length) {
        const qs = serializeParams(params)
        if (qs) query = '?' + qs
      }
      const cleanUrl = url.startsWith('/') ? url.slice(1) : url
      xhr.open(method, `${baseUrl}/${cleanUrl}${query}`)
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
      xhr.responseType = 'blob'
      xhr.onload = function () {
        const responseHeaders = {}
        xhr.getAllResponseHeaders().split('\r\n').forEach(line => {
          const [key, value] = line.split(': ')
          if (key) responseHeaders[key.toLowerCase()] = value
        })
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ blob: xhr.response, headers: responseHeaders })
        } else {
          reject(new Error(`Download failed: ${xhr.status}`))
        }
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.onprogress = (event) => {
        if (onProgress && event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100), event)
        }
      }
      xhr.send(method === 'GET' ? null : JSON.stringify(params))
    })
  }

  return { download }
}
