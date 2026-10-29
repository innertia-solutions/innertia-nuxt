import { describe, it, expect } from 'vitest'
import { sessionOptions, SESSION_COOKIE } from '../session'

describe('sessionOptions', () => {
  it('sella con el password dado y cookie httpOnly/lax/secure/maxAge', () => {
    const o = sessionOptions('x'.repeat(32))
    expect(o.password).toBe('x'.repeat(32))
    expect(o.name).toBe(SESSION_COOKIE)
    expect(o.cookie).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 7 })
  })
  it('permite secure:false (dev http)', () => {
    expect(sessionOptions('x'.repeat(32), { secure: false }).cookie.secure).toBe(false)
  })
  it('lanza si el password es muy corto (<32)', () => {
    expect(() => sessionOptions('corto')).toThrow(/32/)
  })
})
