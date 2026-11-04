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
