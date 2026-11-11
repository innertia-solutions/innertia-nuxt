import { describe, it, expect, vi } from 'vitest'
import { createStatusCache } from '../statusCache'

describe('createStatusCache', () => {
  it('consulta una sola vez por base', async () => {
    const fetcher = vi.fn(async () => ({ enabled: true }))
    const c = createStatusCache().for(fetcher)
    expect(await Promise.all([c.get('auth'), c.get('auth')])).toEqual([true, true])
    expect(fetcher).toHaveBeenCalledTimes(1)
    await c.get('platform/auth')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('fallo = desactivado y se reintenta después', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce({ enabled: true })
    const c = createStatusCache().for(fetcher)
    expect(await c.get('auth')).toBe(false)
    expect(await c.get('auth')).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('respuesta nula o sin enabled es false', async () => {
    const c = createStatusCache().for(async () => null)
    expect(await c.get('auth')).toBe(false)
  })

  it('reset fuerza una nueva consulta', async () => {
    let enabled = false
    const c = createStatusCache().for(async () => ({ enabled }))
    expect(await c.get('auth')).toBe(false)
    enabled = true
    expect(await c.get('auth')).toBe(false)
    c.reset('auth')
    expect(await c.get('auth')).toBe(true)
  })
})
