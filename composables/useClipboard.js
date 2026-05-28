/**
 * useClipboard — Wrapper sobre navigator.clipboard con estado reactivo
 * `copied` que vuelve a false después de `timeout` ms.
 *
 * Hace fallback a un truco con `document.execCommand('copy')` cuando la
 * Clipboard API no está disponible (HTTP, iframes restringidos, etc.).
 *
 * ```js
 * const { copy, copied, supported } = useClipboard({ timeout: 1500 })
 *
 * <button @click="copy('hola mundo')">
 *   {{ copied ? '¡Copiado!' : 'Copiar' }}
 * </button>
 * ```
 *
 * También expone `text` para usar como modelo si querés bindear automáticamente
 * un valor que cambia (ej. un input controlado).
 */
export function useClipboard(options = {}) {
  const timeout = options.timeout ?? 1500

  const text     = ref('')
  const copied   = ref(false)
  const error    = ref(null)
  const supported = computed(() => {
    if (typeof navigator === 'undefined') return false
    return !!(navigator.clipboard && navigator.clipboard.writeText)
  })

  let timeoutId = null

  const _resetSoon = () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      copied.value = false
      error.value  = null
    }, timeout)
  }

  const _legacy = (value) => {
    if (typeof document === 'undefined') return false
    const el = document.createElement('textarea')
    el.value = value
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch (_) { ok = false }
    document.body.removeChild(el)
    return ok
  }

  /** Copia el string al clipboard. Retorna Promise<boolean>. */
  const copy = async (value) => {
    const str = String(value ?? '')
    text.value = str
    error.value = null

    try {
      if (supported.value) {
        await navigator.clipboard.writeText(str)
      } else {
        const ok = _legacy(str)
        if (!ok) throw new Error('No se pudo copiar')
      }
      copied.value = true
      _resetSoon()
      return true
    } catch (e) {
      error.value  = e?.message ?? 'Error al copiar'
      copied.value = false
      return false
    }
  }

  return { copy, copied, error, text, supported }
}
