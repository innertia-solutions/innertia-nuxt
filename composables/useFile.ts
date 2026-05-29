import {
  IconFile, IconPhoto, IconVideo, IconMusic, IconFileZip,
  IconFileTypePdf, IconFileTypeXls, IconFileTypeCsv,
  IconFileTypeDocx, IconFileTypePpt, IconFileTypeTxt,
} from '@tabler/icons-vue'

/**
 * useFile — API unificada para trabajar con archivos del backend innertia-laravel.
 *
 * Cubre:
 *   - upload(endpoint, file|files, { field, onProgress, extraData, signal })
 *   - download(fileId, filename?)            — trigger descarga programática
 *   - view(fileId)                            — abrir inline en otra pestaña
 *   - viewUrl(fileId) / downloadUrl(fileId)   — URLs absolutas a las rutas de innertia-laravel
 *   - formatSize(bytes)                       — helper humano-legible
 *   - iconFor(mimeType)                       — devuelve el componente Tabler para el mime
 *
 * Autenticación: los interceptores de useApi (auth Bearer, X-Tenant, X-Organization)
 * se aplican automáticamente al XHR de upload.
 */
export function useFile() {
  const config  = useRuntimeConfig()
  const baseUrl = config.public.apiBaseUrl || '/api'

  // useRequestInterceptors es el mismo que usa useApi() — comparte auth/tenant/org headers.
  const { run } = useRequestInterceptors()

  // ── URLs ───────────────────────────────────────────────────────────────────
  /** GET /files/{id} — inline view (respeta permisos del backend). */
  const viewUrl     = (fileId) => `${baseUrl}/files/${fileId}`
  /** GET /files/{id}/download — force download (respeta permisos). */
  const downloadUrl = (fileId) => `${baseUrl}/files/${fileId}/download`

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatSize = (bytes) => {
    if (bytes == null) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  /** Devuelve el componente Tabler para un mime type. */
  const iconFor = (mimeType) => {
    if (!mimeType) return IconFile
    if (mimeType.startsWith('image/'))                          return IconPhoto
    if (mimeType.startsWith('video/'))                          return IconVideo
    if (mimeType.startsWith('audio/'))                          return IconMusic
    if (mimeType === 'application/pdf')                         return IconFileTypePdf
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return IconFileTypeXls
    if (mimeType === 'text/csv')                                return IconFileTypeCsv
    if (mimeType.includes('word') || mimeType.includes('document')) return IconFileTypeDocx
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return IconFileTypePpt
    if (mimeType.startsWith('text/'))                           return IconFileTypeTxt
    if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive')) return IconFileZip
    return IconFile
  }

  // ── View / Download ────────────────────────────────────────────────────────
  /** Abre el file inline en una nueva pestaña (usa la auth de cookie). */
  const view = (fileId) => {
    if (typeof window === 'undefined') return
    window.open(viewUrl(fileId), '_blank', 'noopener,noreferrer')
  }

  /**
   * Trigger descarga programática. Funciona con archivos auth/restricted
   * porque el browser envía cookies automáticamente.
   */
  const download = (fileId, filename) => {
    if (typeof window === 'undefined') return
    const a = document.createElement('a')
    a.href = downloadUrl(fileId)
    if (filename) a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // ── Upload (con progress vía XHR) ──────────────────────────────────────────
  /**
   * Upload un archivo (o lista) a un endpoint del producto. El endpoint
   * recibe `multipart/form-data` con el campo `field` y debe persistir el
   * archivo (típicamente `File::fromRequest($request, 'file')` del lado Laravel).
   *
   * Para varios archivos pasa un array — el campo se envía como `field[]`.
   * Devuelve el JSON parseado del response (típicamente el File record creado).
   *
   * Opciones:
   *   field       — nombre del campo. Default 'file'.
   *   onProgress  — callback(percent: number 0-100)
   *   extraData   — campos adicionales para incluir en el FormData
   *   signal      — AbortSignal para cancelar
   */
  const upload = (endpoint, file, options = {}) => {
    const field    = options.field ?? 'file'
    const files    = Array.isArray(file) ? file : [file]
    const formData = new FormData()
    const fieldName = files.length > 1 ? `${field}[]` : field

    for (const f of files) formData.append(fieldName, f)

    if (options.extraData) {
      for (const [k, v] of Object.entries(options.extraData)) {
        if (v == null) continue
        formData.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
      }
    }

    // Recolectar headers vía los interceptores (auth, tenant, org).
    // NO incluimos Content-Type — el browser lo setea con el boundary correcto.
    const headers = {
      'Accept': 'application/json',
      'X-Innertia-Source': import.meta.server ? 'ssr' : 'client',
    }
    run(headers, {})
    delete headers['Content-Type']

    const cleanPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
    const url       = `${baseUrl}/${cleanPath}`

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.withCredentials = true

      for (const [k, v] of Object.entries(headers)) {
        try { xhr.setRequestHeader(k, v) } catch (_) { /* algunos headers son read-only */ }
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && options.onProgress) {
          options.onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total)
        }
      })

      // Cuando el upload del cliente terminó (100%) pero el server aún no
      // respondió — útil para mostrar estado "Procesando…" en la UI.
      xhr.upload.addEventListener('loadend', () => {
        options.onUploaded?.()
      })

      xhr.addEventListener('load', () => {
        const status = xhr.status
        const ctype  = xhr.getResponseHeader('content-type') ?? ''
        const body   = ctype.includes('application/json')
          ? safeJsonParse(xhr.responseText)
          : xhr.responseText

        if (status >= 200 && status < 300) {
          resolve(body)
        } else {
          const err = new Error(`Upload failed (${status})`)
          err.status = status
          err.data   = body
          reject(err)
        }
      })

      xhr.addEventListener('error',   () => reject(new Error('Network error during upload')))
      xhr.addEventListener('abort',   () => reject(Object.assign(new Error('Upload aborted'), { aborted: true })))
      xhr.addEventListener('timeout', () => reject(new Error('Upload timeout')))

      if (options.signal) {
        if (options.signal.aborted) {
          xhr.abort()
          return
        }
        options.signal.addEventListener('abort', () => xhr.abort())
      }

      xhr.send(formData)
    })
  }

  return {
    upload,
    download,
    view,
    viewUrl,
    downloadUrl,
    formatSize,
    iconFor,
  }
}

function safeJsonParse(text) {
  try { return JSON.parse(text) } catch { return text }
}
