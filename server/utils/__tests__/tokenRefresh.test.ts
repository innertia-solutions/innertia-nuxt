import { describe, it, expect, vi } from 'vitest'
import { decodeJwtPayload, shouldRefreshToken, createTokenRotator } from '../tokenRefresh'

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`
}

describe('decodeJwtPayload', () => {
  it('lee el payload sin verificar la firma', () => {
    expect(decodeJwtPayload(jwt({ sub: '7', exp: 100 }))).toEqual({ sub: '7', exp: 100 })
  })
  it('devuelve null con basura', () => {
    expect(decodeJwtPayload('no-es-jwt')).toBeNull()
    expect(decodeJwtPayload(undefined)).toBeNull()
    expect(decodeJwtPayload('a.%%%.c')).toBeNull()
  })
})

describe('shouldRefreshToken', () => {
  const iat = 1_000_000
  const ttl60 = (extra = {}) => jwt({ iat, exp: iat + 3600, ...extra })

  it('no renueva con mucho tiempo por delante', () => {
    expect(shouldRefreshToken(ttl60(), iat + 60)).toBe(false)
  })
  it('renueva cuando quedan menos de 10 minutos', () => {
    expect(shouldRefreshToken(ttl60(), iat + 3600 - 599)).toBe(true)
  })
  it('no renueva un token ya vencido (Laravel no lo acepta)', () => {
    expect(shouldRefreshToken(ttl60(), iat + 3601)).toBe(false)
  })
  it('no renueva tokens de plataforma (identidad separada)', () => {
    expect(shouldRefreshToken(ttl60({ platform: true }), iat + 3500)).toBe(false)
  })
  it('con TTL corto usa 1/3 de la vida como ventana (no renueva en cada request)', () => {
    const short = jwt({ iat, exp: iat + 300 }) // 5 min
    expect(shouldRefreshToken(short, iat + 60)).toBe(false)
    expect(shouldRefreshToken(short, iat + 250)).toBe(true)
  })
  it('sin exp no renueva', () => {
    expect(shouldRefreshToken(jwt({ iat }), iat)).toBe(false)
  })
})

describe('createTokenRotator', () => {
  it('requests en paralelo con el mismo token comparten un solo refresh', async () => {
    let resolve!: (v: string) => void
    const refresh = vi.fn(() => new Promise<string>(r => { resolve = r }))
    const r = createTokenRotator({ refresh })
    const a = r.rotate('viejo')
    const b = r.rotate('viejo')
    resolve('nuevo')
    expect(await a).toBe('nuevo')
    expect(await b).toBe('nuevo')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('un request tardío con el token viejo recibe el nuevo desde la caché', async () => {
    const refresh = vi.fn(async () => 'nuevo')
    let t = 0
    const r = createTokenRotator({ refresh, graceMs: 1000, now: () => t })
    await r.rotate('viejo')
    expect(r.rotatedFrom('viejo')).toBe('nuevo')
    expect(await r.rotate('viejo')).toBe('nuevo')
    expect(refresh).toHaveBeenCalledTimes(1)
    t = 5000
    expect(r.rotatedFrom('viejo')).toBeNull()
  })

  it('si el refresh falla devuelve null (se sigue con el token actual)', async () => {
    const r = createTokenRotator({ refresh: async () => { throw new Error('401') } })
    expect(await r.rotate('viejo')).toBeNull()
    expect(r.rotatedFrom('viejo')).toBeNull()
  })

  it('tras un refresh fallido no reintenta con el mismo token hasta que pase el backoff', async () => {
    let t = 0
    const refresh = vi.fn(async () => { throw new Error('404') })
    const r = createTokenRotator({ refresh, failureBackoffMs: 30_000, now: () => t })
    expect(await r.rotate('viejo')).toBeNull()
    t = 10_000
    expect(await r.rotate('viejo')).toBeNull()
    expect(refresh).toHaveBeenCalledTimes(1)
    t = 31_000
    await r.rotate('viejo')
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('pasa el contexto al refresh', async () => {
    const refresh = vi.fn(async (_t: string, ctx?: string) => `nuevo-${ctx}`)
    const r = createTokenRotator<string>({ refresh })
    expect(await r.rotate('viejo', 'evento')).toBe('nuevo-evento')
  })
})
