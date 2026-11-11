import { describe, it, expect } from 'vitest'
import {
  importPayload, isFinished, processedCount, progressPercent, groupItems, selectionFlags,
  refreshOutcome, itemLabel, RESULT_ORDER, type FileImport,
} from '../progress'

const imp = (over: Partial<FileImport> = {}): FileImport => ({
  id: 'i', kind: 'import', status: 'running', found: 4, imported: 1, updated: 1, unchanged: 0,
  skipped: 1, failed: 0, items: [], error: null, ...over,
} as FileImport)

describe('importPayload', () => {
  it('manda ids únicos y omite opcionales vacíos', () => {
    expect(importPayload({ items: [{ id: 'a' }, { id: 'a' }, { id: 'b' }] as any }))
      .toEqual({ items: ['a', 'b'], native_format: 'office' })
    expect(importPayload({ items: ['a'], directoryId: 'd1', nativeFormat: 'pdf', visibility: 'restricted' }))
      .toEqual({ items: ['a'], target_directory_id: 'd1', native_format: 'pdf', visibility: 'restricted' })
  })
})

describe('estado', () => {
  it('sabe cuándo terminó', () => {
    expect(isFinished('done')).toBe(true)
    expect(isFinished('failed')).toBe(true)
    expect(isFinished('running')).toBe(false)
    expect(isFinished(undefined)).toBe(false)
  })
  it('calcula el progreso acotado a 100', () => {
    expect(processedCount(imp())).toBe(3)
    expect(progressPercent(imp())).toBe(75)
    expect(progressPercent(imp({ found: 0 }))).toBeNull()
    expect(progressPercent(imp({ found: 1, failed: 5 }))).toBe(100)
  })
})

describe('items', () => {
  it('agrupa por resultado en orden estable', () => {
    const g = groupItems([
      { result: 'failed', name: 'x', external_id: 'x' },
      { result: 'imported', name: 'a', external_id: 'a' },
      { result: 'imported', name: 'b', external_id: 'b' },
    ] as any)
    expect(g.map(x => [x.result, x.items.length])).toEqual([['imported', 2], ['failed', 1]])
    expect(RESULT_ORDER[0]).toBe('imported')
  })
  it('etiqueta con su ruta', () => {
    expect(itemLabel({ name: 'acta.pdf', path: 'Auditoría/2026' } as any)).toBe('Auditoría/2026/acta.pdf')
    expect(itemLabel({ name: 'acta.pdf', path: '' } as any)).toBe('acta.pdf')
    expect(itemLabel({ name: null, external_id: 'abc' } as any)).toBe('abc')
  })
  it('detecta carpetas y nativos en la selección', () => {
    expect(selectionFlags([{ is_folder: true, is_native: false }, { is_folder: false, is_native: true }] as any))
      .toEqual({ hasFolders: true, hasNatives: true })
    expect(selectionFlags([] as any)).toEqual({ hasFolders: false, hasNatives: false })
  })
})

describe('refreshOutcome', () => {
  it('traduce el resultado de un refresh', () => {
    expect(refreshOutcome(imp({ status: 'done', updated: 1 })).kind).toBe('updated')
    expect(refreshOutcome(imp({ status: 'done', updated: 0, unchanged: 1 })).kind).toBe('unchanged')
    expect(refreshOutcome(imp({ status: 'failed', error: 'Ya no existe' }))).toEqual({ kind: 'failed', message: 'Ya no existe' })
    expect(refreshOutcome(imp({ status: 'failed', error: null })).message).toBe('No se pudo actualizar desde Google Drive.')
  })
})
