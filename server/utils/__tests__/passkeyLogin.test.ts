import { describe, it, expect } from 'vitest'
import { normalizePasskeyLoginResponse, passkeyLoginErrorMessage } from '../passkeyLogin'

describe('normalizePasskeyLoginResponse', () => {
  it('separa el token y conserva el contexto elegido', () => {
    const { token, body } = normalizePasskeyLoginResponse({ token: 't1', user: { id: 1 }, context: 'portal' })
    expect(token).toBe('t1')
    expect(body).toMatchObject({ user: { id: 1 }, context: 'portal' })
    expect(body).not.toHaveProperty('token')
  })

  it('un paso previo no trae token y conserva el flag, user_id y contexto', () => {
    const { token, body } = normalizePasskeyLoginResponse({ requires_password_change: true, user_id: 7, context: 'backoffice' })
    expect(token).toBeUndefined()
    expect(body).toMatchObject({ requires_password_change: true, user_id: 7, context: 'backoffice' })
  })

  it('sin contexto (plataforma) no agrega la clave', () => {
    const { body } = normalizePasskeyLoginResponse({ token: 't', user: { id: 1 } })
    expect(body).not.toHaveProperty('context')
  })
})

describe('passkeyLoginErrorMessage', () => {
  it('422 → mensaje genérico de passkey', () => {
    expect(passkeyLoginErrorMessage(422, {})).toBe('No pudimos verificar la passkey.')
  })
  it('429 → demasiados intentos', () => {
    expect(passkeyLoginErrorMessage(429, {})).toMatch(/Demasiados intentos/)
  })
  it('403/409 → mensaje del backend', () => {
    expect(passkeyLoginErrorMessage(403, { message: 'Esta cuenta no tiene acceso a esta aplicación.' })).toBe('Esta cuenta no tiene acceso a esta aplicación.')
    expect(passkeyLoginErrorMessage(409, { message: 'Usa el acceso de plataforma.' })).toBe('Usa el acceso de plataforma.')
  })
  it('otro error sin mensaje → genérico', () => {
    expect(passkeyLoginErrorMessage(500, null)).toBe('No se pudo iniciar sesión con la passkey. Inténtalo de nuevo.')
  })
})
