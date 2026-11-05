import { describe, it, expect } from 'vitest'
import { normalizeLoginResponse, loginErrorMessage } from '../login'

describe('normalizeLoginResponse', () => {
  it('separa el token del resto', () => {
    const r = normalizeLoginResponse({
      token: 'jwt', user: { id: '1' }, contexts: ['backoffice'], requires_password_change: false,
    })
    expect(r.token).toBe('jwt')
    expect(r.body).toEqual({ user: { id: '1' }, contexts: ['backoffice'], requires_password_change: false })
    expect((r.body as any).token).toBeUndefined()
  })
  it('cambio forzado: sin token reenvía user_id y el flag', () => {
    const r = normalizeLoginResponse({ requires_password_change: true, user_id: 'u-1' } as any)
    expect(r.token).toBeUndefined()
    expect(r.body).toMatchObject({ requires_password_change: true, user_id: 'u-1' })
  })
  it('OTP/2FA: reenvía el flag y user_id', () => {
    expect(normalizeLoginResponse({ requires_otp: true, user_id: 'u-2' } as any).body).toMatchObject({ requires_otp: true, user_id: 'u-2' })
    expect(normalizeLoginResponse({ requires_2fa: true, user_id: 'u-3' } as any).body).toMatchObject({ requires_2fa: true, user_id: 'u-3' })
  })
  it('acepta access_token como alias', () => {
    expect(normalizeLoginResponse({ access_token: 'jwt2' }).token).toBe('jwt2')
  })
})

describe('loginErrorMessage', () => {
  it('422 → credenciales incorrectas en español (no el genérico de Laravel)', () => {
    expect(loginErrorMessage(422, { message: 'Invalid credentials.' })).toBe('Correo o contraseña incorrectos.')
  })
  it('429 → throttle', () => {
    expect(loginErrorMessage(429, null)).toContain('Demasiados intentos')
  })
  it('otros → mensaje del backend o fallback', () => {
    expect(loginErrorMessage(403, { message: 'Esta cuenta no tiene acceso al panel de plataforma.' }))
      .toBe('Esta cuenta no tiene acceso al panel de plataforma.')
    expect(loginErrorMessage(500, null)).toBe('No se pudo iniciar sesión. Inténtalo de nuevo.')
  })
})
