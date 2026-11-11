import { describe, it, expect } from 'vitest'
import { createRunGuard } from '../runGuard'

describe('createRunGuard', () => {
  it('la última corrida es la vigente', () => {
    const g = createRunGuard()
    const a = g.next()
    expect(g.isCurrent(a)).toBe(true)
    const b = g.next()
    expect(g.isCurrent(a)).toBe(false)
    expect(g.isCurrent(b)).toBe(true)
  })

  it('invalidate() deja sin vigencia la corrida en vuelo', () => {
    const g = createRunGuard()
    const a = g.next()
    g.invalidate()
    expect(g.isCurrent(a)).toBe(false)
  })

  it('dispose() invalida la actual y las futuras', () => {
    const g = createRunGuard()
    const a = g.next()
    g.dispose()
    expect(g.disposed).toBe(true)
    expect(g.isCurrent(a)).toBe(false)
    const b = g.next()
    expect(g.isCurrent(b)).toBe(false)
  })

  it('descarta una corrida vieja tras un await (carrera)', async () => {
    const g = createRunGuard()
    const results: string[] = []
    const run = async (label: string, delay: number) => {
      const id = g.next()
      await new Promise(r => setTimeout(r, delay))
      if (g.isCurrent(id)) results.push(label)
    }
    await Promise.all([run('vieja', 20), run('nueva', 5)])
    expect(results).toEqual(['nueva'])
  })
})
