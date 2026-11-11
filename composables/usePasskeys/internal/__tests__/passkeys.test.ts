import { describe, it, expect } from 'vitest'
import { passkeyErrorMessage, isPasskeyCancel, isPasskeyDismissed, contextsRequiredError, CONTEXTS_REQUIRED, suggestPasskeyName, shouldShowPasskeyInvite, inviteStorageKey } from '../passkeys'

const domErr = (name: string) => Object.assign(new Error(name), { name })

describe('passkeyErrorMessage', () => {
  it('traduce errores del navegador', () => {
    expect(passkeyErrorMessage(domErr('NotAllowedError'))).toBe('Se canceló o se agotó el tiempo. Inténtalo de nuevo.')
    expect(passkeyErrorMessage(domErr('InvalidStateError'))).toBe('Este dispositivo ya tiene una passkey para tu cuenta.')
    expect(passkeyErrorMessage(domErr('SecurityError'))).toBe('Este sitio no está habilitado para passkeys. Avisa al administrador.')
    expect(passkeyErrorMessage(domErr('NotSupportedError'))).toBe('Este navegador no permite usar passkeys.')
  })
  it('usa el mensaje del backend (FetchError de ofetch)', () => {
    expect(passkeyErrorMessage({ data: { message: 'No pudimos verificar la passkey.' } })).toBe('No pudimos verificar la passkey.')
  })
  it('cae a un genérico', () => {
    expect(passkeyErrorMessage(new Error('x'))).toBe('No se pudo completar la operación con la passkey.')
  })
  it('simplewebauthn envuelve el error del navegador en .cause', () => {
    expect(passkeyErrorMessage({ name: 'WebAuthnError', code: 'ERROR_CEREMONY_ABORTED', cause: domErr('NotAllowedError') }))
      .toBe('Se canceló o se agotó el tiempo. Inténtalo de nuevo.')
  })
})

describe('isPasskeyCancel', () => {
  it('detecta cancelaciones y aborts (no se muestran como error)', () => {
    expect(isPasskeyCancel(domErr('AbortError'))).toBe(true)
    expect(isPasskeyCancel({ name: 'WebAuthnError', code: 'ERROR_CEREMONY_ABORTED' })).toBe(true)
    expect(isPasskeyCancel(domErr('SecurityError'))).toBe(false)
  })
  it('NotAllowedError no es un abort (en gestión sigue mostrando mensaje)', () => {
    expect(isPasskeyCancel(domErr('NotAllowedError'))).toBe(false)
  })
})

describe('isPasskeyDismissed (botón de ingreso)', () => {
  it('trata NotAllowedError como cancelación del usuario', () => {
    expect(isPasskeyDismissed(domErr('NotAllowedError'))).toBe(true)
    expect(isPasskeyDismissed({ name: 'WebAuthnError', code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY', cause: domErr('NotAllowedError') })).toBe(true)
  })
  it('incluye los aborts', () => {
    expect(isPasskeyDismissed(domErr('AbortError'))).toBe(true)
    expect(isPasskeyDismissed({ name: 'WebAuthnError', code: 'ERROR_CEREMONY_ABORTED' })).toBe(true)
  })
  it('no oculta errores reales', () => {
    expect(isPasskeyDismissed(domErr('SecurityError'))).toBe(false)
    expect(isPasskeyDismissed({ data: { message: 'No pudimos verificar la passkey.' } })).toBe(false)
  })
})

describe('contextsRequiredError', () => {
  it('lleva mensaje y código', () => {
    const e: any = contextsRequiredError()
    expect(e.message).toBe('PasskeyButton requiere contexts')
    expect(e.code).toBe(CONTEXTS_REQUIRED)
  })
})

describe('suggestPasskeyName', () => {
  it('arma "Dispositivo · Navegador"', () => {
    expect(suggestPasskeyName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15')).toBe('Mac · Safari')
    expect(suggestPasskeyName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toBe('Mac · Chrome')
    expect(suggestPasskeyName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari')
    expect(suggestPasskeyName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Windows · Edge')
    expect(suggestPasskeyName('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe('Android · Chrome')
    expect(suggestPasskeyName('')).toBe('Passkey')
  })
})

describe('shouldShowPasskeyInvite', () => {
  const base = { supported: true, enabled: true, dismissed: false, hasPasskeys: false, loggedInWithPasskey: false }
  it('se muestra solo si todo calza', () => {
    expect(shouldShowPasskeyInvite(base)).toBe(true)
    expect(shouldShowPasskeyInvite({ ...base, supported: false })).toBe(false)
    expect(shouldShowPasskeyInvite({ ...base, enabled: false })).toBe(false)
    expect(shouldShowPasskeyInvite({ ...base, dismissed: true })).toBe(false)
    expect(shouldShowPasskeyInvite({ ...base, hasPasskeys: true })).toBe(false)
    expect(shouldShowPasskeyInvite({ ...base, loggedInWithPasskey: true })).toBe(false)
  })
  it('la clave de localStorage es por usuario', () => {
    expect(inviteStorageKey(42)).toBe('innertia:passkey-invite:42')
  })
})
