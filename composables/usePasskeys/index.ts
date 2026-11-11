import { ref } from 'vue'
import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  WebAuthnAbortService,
} from '@simplewebauthn/browser'
import { passkeyErrorMessage, isPasskeyCancel, suggestPasskeyName } from './internal/passkeys'

// Solo se exporta el composable (los helpers de ./internal no se auto-importan).

/** Marca de sesión: el último ingreso fue con passkey (la invitación no se muestra). */
const PASSKEY_LOGIN_FLAG = 'innertia:logged-in-with-passkey'

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
 */
export function usePasskeys() {
  const api = useApi()
  const authStore = useAuthStore()
  const { finishLogin } = useAuth()

  const supported = ref(false)
  const autofillSupported = ref(false)
  if (import.meta.client) {
    supported.value = browserSupportsWebAuthn()
    browserSupportsWebAuthnAutofill().then(v => { autofillSupported.value = v }).catch(() => {})
  }

  function markPasskeyLogin(on: boolean) {
    if (!import.meta.client) return
    try { on ? sessionStorage.setItem(PASSKEY_LOGIN_FLAG, '1') : sessionStorage.removeItem(PASSKEY_LOGIN_FLAG) } catch {}
  }

  function loggedInWithPasskey(): boolean {
    if (!import.meta.client) return false
    try { return sessionStorage.getItem(PASSKEY_LOGIN_FLAG) === '1' } catch { return false }
  }

  /** Ceremonia de ingreso + BFF. Devuelve el body (con `context`); si hubo token, ya cerró el login. */
  async function authenticate(platform: boolean, contexts: string[], autofill: boolean) {
    const optionsPath = platform ? 'platform/auth/passkey/login/options' : 'auth/passkey/login/options'
    const { key, options } = await api.post(optionsPath)
    const response = await startAuthentication({ optionsJSON: options, useBrowserAutofill: autofill })
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

  /** Botón "Ingresar con huella o passkey". */
  const login = ({ contexts }: { contexts: string[] }) => authenticate(false, contexts, false)

  const loginPlatform = () => authenticate(true, [], false)

  /**
   * Autocompletado (conditional UI): el navegador sugiere la passkey al enfocar el
   * campo de correo (necesita autocomplete="username webauthn"). Queda esperando
   * hasta que el usuario elija una o se llame a stopAutofill(). Devuelve null si se canceló.
   */
  async function startAutofill({ contexts = [], platform = false }: { contexts?: string[]; platform?: boolean } = {}) {
    if (!autofillSupported.value) return null
    try {
      return await authenticate(platform, contexts, true)
    } catch (err) {
      if (isPasskeyCancel(err)) return null
      throw err
    }
  }

  function stopAutofill() {
    WebAuthnAbortService.cancelCeremony()
  }

  // ── Gestión propia ────────────────────────────────────────────────────────

  async function list(base = 'auth'): Promise<PasskeyItem[]> {
    const res: any = await api.get(`${base}/me/passkeys`)
    return res?.data ?? []
  }

  async function register(name?: string, base = 'auth'): Promise<PasskeyItem> {
    const { key, options } = await api.post(`${base}/me/passkeys/options`)
    const response = await startRegistration({ optionsJSON: options })
    const ua = import.meta.client ? navigator.userAgent : ''
    return api.post(`${base}/me/passkeys`, { key, response, name: name || suggestPasskeyName(ua) })
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
    login,
    loginPlatform,
    startAutofill,
    stopAutofill,
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
  }
}
