// Lógica pura de passkeys (sin Vue ni navegador): testeable en node.

const BROWSER_ERRORS: Record<string, string> = {
  NotAllowedError: 'Se canceló o se agotó el tiempo. Inténtalo de nuevo.',
  InvalidStateError: 'Este dispositivo ya tiene una passkey para tu cuenta.',
  SecurityError: 'Este sitio no está habilitado para passkeys. Avisa al administrador.',
  NotSupportedError: 'Este navegador no permite usar passkeys.',
}

const GENERIC = 'No se pudo completar la operación con la passkey.'

function browserErrorName(err: any): string | undefined {
  // simplewebauthn lanza WebAuthnError con el DOMException original en .cause
  return err?.cause?.name ?? err?.name
}

/** Cancelación del usuario o abort del autocompletado: no se muestra como error. */
export function isPasskeyCancel(err: any): boolean {
  const name = browserErrorName(err)
  return name === 'AbortError' || err?.code === 'ERROR_CEREMONY_ABORTED'
}

export function passkeyErrorMessage(err: any): string {
  const backend = err?.data?.message
  if (typeof backend === 'string' && backend) return backend
  const name = browserErrorName(err)
  return (name && BROWSER_ERRORS[name]) || GENERIC
}

export function suggestPasskeyName(userAgent: string): string {
  const ua = userAgent || ''
  const device = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : ''
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : ''
  if (!device && !browser) return 'Passkey'
  return [device, browser].filter(Boolean).join(' · ')
}

export interface PasskeyInviteState {
  supported: boolean
  enabled: boolean
  dismissed: boolean
  hasPasskeys: boolean
  loggedInWithPasskey: boolean
}

export function shouldShowPasskeyInvite(s: PasskeyInviteState): boolean {
  return s.supported && s.enabled && !s.dismissed && !s.hasPasskeys && !s.loggedInWithPasskey
}

export function inviteStorageKey(userId: string | number): string {
  return `innertia:passkey-invite:${userId}`
}
