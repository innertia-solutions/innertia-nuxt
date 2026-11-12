import { describe, it, expect } from 'vitest'
import { shouldThrowOnUnauthorized, unauthorizedError, SESSION_EXPIRED_MESSAGE } from '../apiUnauthorized.js'

describe('shouldThrowOnUnauthorized (contrato de useApi ante 401)', () => {
  it('en el cliente, las mutaciones lanzan (no se confunden con éxito)', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
      expect(shouldThrowOnUnauthorized(m, {}, true)).toBe(true)
    }
  })
  it('GET devuelve null (fetchMe/auth-init/queries dependen de eso)', () => {
    expect(shouldThrowOnUnauthorized('GET', {}, true)).toBe(false)
  })
  it('en SSR nunca lanza por defecto (evita 500 en vez del redirect)', () => {
    expect(shouldThrowOnUnauthorized('POST', {}, false)).toBe(false)
  })
  it('options.throwOnUnauthorized manda sobre el default', () => {
    expect(shouldThrowOnUnauthorized('GET', { throwOnUnauthorized: true }, true)).toBe(true)
    expect(shouldThrowOnUnauthorized('POST', { throwOnUnauthorized: false }, true)).toBe(false)
  })
})

describe('unauthorizedError', () => {
  it('tiene la forma de los errores HTTP de useApi', () => {
    const e: any = unauthorizedError()
    expect(e).toBeInstanceOf(Error)
    expect(e.status).toBe(401)
    expect(e.data.message).toBe(SESSION_EXPIRED_MESSAGE)
  })
})
