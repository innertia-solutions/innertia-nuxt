import { describe, it, expect } from 'vitest'
import { resolveApiTarget, buildAuthHeaders } from '../bff'

describe('resolveApiTarget', () => {
  it('arma base + path + querystring (Laravel sirve en root, sin /api)', () => {
    expect(resolveApiTarget('http://api:80', 'auth/me', '')).toBe('http://api:80/auth/me')
    expect(resolveApiTarget('http://api:80', 'question-bank', '?perPage=1'))
      .toBe('http://api:80/question-bank?perPage=1')
  })
  it('normaliza slashes duplicados en la base', () => {
    expect(resolveApiTarget('http://api:80/', 'auth/me', '')).toBe('http://api:80/auth/me')
  })
})

describe('buildAuthHeaders', () => {
  it('con token inyecta Authorization y vacía la cookie', () => {
    expect(buildAuthHeaders('jwt123')).toEqual({ authorization: 'Bearer jwt123', cookie: '' })
  })
  it('sin token solo vacía la cookie (no manda Authorization)', () => {
    expect(buildAuthHeaders(undefined)).toEqual({ cookie: '' })
  })
})
