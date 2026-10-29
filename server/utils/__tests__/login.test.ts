import { describe, it, expect } from 'vitest'
import { normalizeLoginResponse } from '../login'

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
