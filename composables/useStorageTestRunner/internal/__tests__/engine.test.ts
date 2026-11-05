import { describe, it, expect } from 'vitest'
import { runSteps, describeError, type StepDef } from '../engine'

const ok = (id: string, extra: Partial<StepDef<any>> = {}): StepDef<any> => ({ id, label: id, run: async () => `${id} listo`, ...extra })
const boom = (id: string, extra: Partial<StepDef<any>> = {}): StepDef<any> => ({
  id, label: id, run: async () => { throw Object.assign(new Error('API error 500'), { status: 500, data: { message: 'falló' } }) }, ...extra,
})

describe('runSteps', () => {
  it('corre en orden y marca ok con detalle y duración', async () => {
    const order: string[] = []
    const defs = ['a', 'b'].map(id => ok(id, { run: async () => { order.push(id); return `${id} listo` } }))
    const res = await runSteps(defs, {}, () => {})
    expect(order).toEqual(['a', 'b'])
    expect(res.map(r => r.status)).toEqual(['ok', 'ok'])
    expect(res[0].detail).toBe('a listo')
    expect(typeof res[0].ms).toBe('number')
  })

  it('omite dependientes de un paso fallido y siempre corre los always', async () => {
    const res = await runSteps([boom('a'), ok('b', { dependsOn: ['a'] }), ok('c'), ok('z', { always: true, dependsOn: ['a'] })], {}, () => {})
    expect(res.map(r => r.status)).toEqual(['failed', 'skipped', 'ok', 'ok'])
    expect(res[0].detail).toBe('HTTP 500: falló')
    expect(res[1].detail).toBe('Depende de: a')
  })

  it('when=false deja el paso omitido como desactivado', async () => {
    const res = await runSteps([ok('a', { when: () => false })], {}, () => {})
    expect(res[0]).toMatchObject({ status: 'skipped', detail: 'Desactivado' })
  })

  it('abortado: omite lo que falta salvo always', async () => {
    const ctrl = new AbortController()
    const defs = [ok('a', { run: async () => { ctrl.abort() } }), ok('b'), ok('z', { always: true })]
    const res = await runSteps(defs, {}, () => {}, ctrl.signal)
    expect(res.map(r => r.status)).toEqual(['ok', 'skipped', 'ok'])
    expect(res[1].detail).toBe('Cancelado')
  })

  it('emite snapshots en cada cambio de estado', async () => {
    const snaps: string[][] = []
    await runSteps([ok('a')], {}, r => snaps.push(r.map(x => x.status)))
    expect(snaps).toEqual([['pending'], ['running'], ['ok']])
  })
})

describe('describeError', () => {
  it('usa status + message del backend o el message del error', () => {
    expect(describeError({ status: 404, data: { message: 'no' } })).toBe('HTTP 404: no')
    expect(describeError(new Error('red caída'))).toBe('red caída')
  })
})
