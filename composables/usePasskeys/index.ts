import { ref, getCurrentInstance, onMounted, onBeforeUnmount } from 'vue'
import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  WebAuthnAbortService,
} from '@simplewebauthn/browser'
import {
  passkeyErrorMessage,
  isPasskeyCancel,
  isPasskeyDismissed,
  suggestPasskeyName,
  contextsRequiredError,
  CONTEXTS_REQUIRED,
  WEBAUTHN_INPUT_SELECTOR,
} from './internal/passkeys'
import { createRunGuard } from './internal/runGuard'

// Solo se exporta el composable (los helpers de ./internal no se auto-importan).

/** Marca de sesión: el último ingreso fue con passkey (la invitación no se muestra). */
const PASSKEY_LOGIN_FLAG = 'innertia:logged-in-with-passkey'

/** El reto vive 300 s en el backend: el autocompletado se renueva antes. */
const AUTOFILL_RENEW_MS = 270_000

/** Soporte de autocompletado: se consulta una vez por página (solo en el cliente). */
let autofillSupport: Promise<boolean> | null = null
function supportsAutofill(): Promise<boolean> {
  if (!import.meta.client) return Promise.resolve(false)
  autofillSupport ??= browserSupportsWebAuthnAutofill().catch(() => false)
  return autofillSupport
}

function debug(...args: any[]) {
  if (import.meta.dev) console.debug('[passkeys]', ...args)
}

export interface PasskeyItem {
  id: string
  name: string
  provider: string | null
  created_at: string | null
  last_used_at: string | null
}

/**
 * Passkeys (WebAuthn) sobre innertia-laravel \Innertia\Passkeys.
 *  - Ingreso: opciones por /api, ceremonia en el navegador, verificación por el BFF
 *    (/_auth/passkey/login) que sella la sesión solo si hay token.
 *  - Gestión propia: base 'auth' (tenant) o 'platform/auth' (cuenta de plataforma).
 *
 * Llamar durante el setup de un componente: `supported`/`autofillSupported` se
 * resuelven en onMounted (false en SSR y en el primer render → sin hydration
 * mismatch) y el autocompletado se libera en onBeforeUnmount.
 */
export function usePasskeys() {
  const api = useApi()
  const authStore = useAuthStore()
  const { finishLogin } = useAuth()

  const supported = ref(false)
  const autofillSupported = ref(false)
  /** true una vez resuelto el soporte en el cliente (para no mostrar "no soportado" antes de tiempo). */
  const ready = ref(false)

  async function detectSupport() {
    supported.value = browserSupportsWebAuthn()
    autofillSupported.value = await supportsAutofill()
    ready.value = true
  }

  // Autocompletado: corridas (generación) + fase + temporizador de renovación.
  const guard = createRunGuard()
  let autofillPhase: 'idle' | 'options' | 'waiting' | 'verifying' = 'idle'
  let renewTimer: ReturnType<typeof setTimeout> | null = null
  let renewRequested = false

  function clearRenewTimer() {
    if (renewTimer) clearTimeout(renewTimer)
    renewTimer = null
  }

  if (getCurrentInstance()) {
    onMounted(() => { detectSupport() })
    onBeforeUnmount(dispose)
  } else if (import.meta.client) {
    detectSupport()
  }

  function markPasskeyLogin(on: boolean) {
    if (!import.meta.client) return
    try { on ? sessionStorage.setItem(PASSKEY_LOGIN_FLAG, '1') : sessionStorage.removeItem(PASSKEY_LOGIN_FLAG) } catch {}
  }

  function loggedInWithPasskey(): boolean {
    if (!import.meta.client) return false
    try { return sessionStorage.getItem(PASSKEY_LOGIN_FLAG) === '1' } catch { return false }
  }

  function assertContexts(platform: boolean, contexts: string[]) {
    if (platform || contexts?.length) return
    if (import.meta.dev) console.warn('[passkeys] PasskeyButton requiere contexts (login de tenant): pasa :contexts="[...]" o usa la prop platform.')
    throw contextsRequiredError()
  }

  async function fetchLoginOptions(platform: boolean) {
    const res: any = await api.post(platform ? 'platform/auth/passkey/login/options' : 'auth/passkey/login/options')
    if (!res?.key || !res?.options) throw new Error('No se pudieron obtener las opciones de la passkey.')
    return res as { key: string; options: any }
  }

  /** Verificación por el BFF (+ cierre del login). Devuelve el body; si hubo token, ya cerró el login. */
  async function verify(platform: boolean, contexts: string[], key: string, response: any) {
    const data: any = await $fetch(platform ? '/_auth/platform/passkey/login' : '/_auth/passkey/login', {
      method: 'POST',
      body: platform ? { key, response } : { key, response, contexts },
    })

    if (!data?.user) return data // paso previo (cambio forzado / verificación de correo)

    markPasskeyLogin(true)
    if (platform) {
      authStore.setAuthenticated(true)
      authStore.saveUser(data.user)
      return data
    }
    return finishLogin(data.context, data)
  }

  /** Ceremonia iniciada por el usuario (botón). Invalida antes el autocompletado. */
  async function authenticate(platform: boolean, contexts: string[]) {
    assertContexts(platform, contexts)
    stopAutofill()
    const { key, options } = await fetchLoginOptions(platform)
    const response = await startAuthentication({ optionsJSON: options })
    return verify(platform, contexts, key, response)
  }

  /** Botón "Ingresar con huella o passkey". */
  const login = ({ contexts }: { contexts: string[] }) => authenticate(false, contexts)

  const loginPlatform = () => authenticate(true, [])

  /**
   * Autocompletado (conditional UI): el navegador sugiere la passkey al enfocar el
   * campo de correo (necesita un input con autocomplete="username webauthn").
   * Queda esperando hasta que el usuario elija una, se llame a stopAutofill() o se
   * desmonte el componente; se renueva solo antes de que venza el reto (300 s).
   *
   * Devuelve null si no arrancó o se canceló. Los errores previos a que el usuario
   * elija una passkey se silencian (console.debug); solo lanza los errores del BFF
   * tras elegir una, y el de configuración (login de tenant sin contexts).
   */
  async function startAutofill({ contexts = [], platform = false }: { contexts?: string[]; platform?: boolean } = {}) {
    if (!import.meta.client || guard.disposed) return null
    assertContexts(platform, contexts)
    const id = guard.next()
    clearRenewTimer()

    if (!(await supportsAutofill())) return null
    if (!guard.isCurrent(id)) return null

    while (guard.isCurrent(id)) {
      if (!document.querySelector(WEBAUTHN_INPUT_SELECTOR)) {
        debug('sin input con autocomplete "… webauthn": no se arranca el autocompletado')
        return null
      }

      let key: string
      let options: any
      autofillPhase = 'options'
      try {
        ({ key, options } = await fetchLoginOptions(platform))
      } catch (err) {
        debug('opciones del autocompletado', err)
        if (guard.isCurrent(id)) autofillPhase = 'idle'
        return null
      }
      if (!guard.isCurrent(id)) return null

      let response: any
      autofillPhase = 'waiting'
      renewRequested = false
      renewTimer = setTimeout(() => {
        renewTimer = null
        if (!guard.isCurrent(id) || autofillPhase !== 'waiting') return
        renewRequested = true
        WebAuthnAbortService.cancelCeremony()
      }, AUTOFILL_RENEW_MS)
      try {
        response = await startAuthentication({ optionsJSON: options, useBrowserAutofill: true })
      } catch (err) {
        if (guard.isCurrent(id)) clearRenewTimer()
        if (renewRequested && guard.isCurrent(id)) {
          renewRequested = false
          continue // reto por vencer: pedir uno nuevo
        }
        debug('autocompletado terminado', err)
        if (guard.isCurrent(id)) autofillPhase = 'idle'
        return null
      }
      clearRenewTimer()
      if (!guard.isCurrent(id)) return null

      // El usuario eligió una passkey: desde aquí los errores sí se muestran.
      autofillPhase = 'verifying'
      try {
        return await verify(platform, contexts, key, response)
      } finally {
        if (guard.isCurrent(id)) autofillPhase = 'idle'
      }
    }
    return null
  }

  /** Detiene el autocompletado (también las corridas aún pidiendo opciones). */
  function stopAutofill() {
    const wasWaiting = autofillPhase === 'waiting'
    guard.invalidate()
    clearRenewTimer()
    renewRequested = false
    autofillPhase = 'idle'
    if (wasWaiting) WebAuthnAbortService.cancelCeremony()
  }

  /** Libera el composable: ningún autocompletado vuelve a arrancar. */
  function dispose() {
    stopAutofill()
    guard.dispose()
  }

  // ── Gestión propia ────────────────────────────────────────────────────────

  async function list(base = 'auth'): Promise<PasskeyItem[]> {
    const res: any = await api.get(`${base}/me/passkeys`)
    return res?.data ?? []
  }

  /** useApi devuelve null en 401: error legible (passkeyErrorMessage lee data.message). */
  function sessionError() {
    return Object.assign(new Error('Tu sesión expiró. Vuelve a ingresar para gestionar tus passkeys.'), {
      data: { message: 'Tu sesión expiró. Vuelve a ingresar para gestionar tus passkeys.' },
    })
  }

  async function register(name?: string, base = 'auth'): Promise<PasskeyItem> {
    const res: any = await api.post(`${base}/me/passkeys/options`)
    if (!res?.key || !res?.options) throw sessionError()
    const response = await startRegistration({ optionsJSON: res.options })
    const ua = import.meta.client ? navigator.userAgent : ''
    const created: any = await api.post(`${base}/me/passkeys`, { key: res.key, response, name: name || suggestPasskeyName(ua) })
    if (!created) throw sessionError()
    return created
  }

  const rename = (id: string, name: string, base = 'auth') => api.patch(`${base}/me/passkeys/${id}`, { name })

  const remove = (id: string, base = 'auth') => api.delete(`${base}/me/passkeys/${id}`)

  // ── Administración ────────────────────────────────────────────────────────

  async function listForUser(userId: string | number): Promise<PasskeyItem[]> {
    const res: any = await api.get(`users/${userId}/passkeys`)
    return res?.data ?? []
  }

  async function revokeAll(userId: string | number): Promise<number> {
    const res: any = await api.delete(`users/${userId}/passkeys`)
    return res?.revoked ?? 0
  }

  return {
    supported,
    autofillSupported,
    ready,
    login,
    loginPlatform,
    startAutofill,
    stopAutofill,
    dispose,
    isDisposed: () => guard.disposed,
    loggedInWithPasskey,
    markPasskeyLogin,
    list,
    register,
    rename,
    remove,
    listForUser,
    revokeAll,
    errorMessage: passkeyErrorMessage,
    isCancel: isPasskeyCancel,
    isDismissed: isPasskeyDismissed,
    isContextsError: (err: any) => err?.code === CONTEXTS_REQUIRED,
  }
}
