import { describe, it, expect } from 'vitest'
import {
  joinPath, driveEndpoints, rootLocation, enter, goTo, current, breadcrumb, browseParams,
  canPickCurrentFolder, locationFromPath, matchesAccept, isSelectable, toggleSelection,
  MAX_SELECTION, type DriveEntry,
} from '../browser'

const entry = (over: Partial<DriveEntry> = {}): DriveEntry => ({
  id: 'x', name: 'x', mime_type: 'application/pdf', size: 1, modified_time: null,
  web_url: null, drive_id: null, is_folder: false, is_native: false, ...over,
})

describe('endpoints', () => {
  it('une prefijos sin barras dobles', () => {
    expect(joinPath('/platform/', 'drive/browse')).toBe('platform/drive/browse')
    expect(joinPath('', 'drive/browse')).toBe('drive/browse')
  })
  it('arma las rutas de Drive e imports', () => {
    const ep = driveEndpoints('platform')
    expect(ep.browse).toBe('platform/drive/browse')
    expect(ep.item('a b')).toBe('platform/drive/items/a%20b')
    expect(ep.folders).toBe('platform/drive/folders')
    expect(ep.imports).toBe('platform/files/imports')
    expect(ep.importShow('u-1')).toBe('platform/files/imports/u-1')
    expect(ep.refresh('f-1')).toBe('platform/files/f-1/refresh')
  })
})

describe('navegación', () => {
  it('parte en Mi unidad y entra/vuelve por migas', () => {
    let loc = rootLocation()
    expect(current(loc)).toEqual({ id: 'root', name: 'Mi unidad' })
    loc = enter(loc, { id: 'A', name: 'Auditoría' })
    loc = enter(loc, { id: 'B', name: '2026' })
    expect(breadcrumb(loc).map(c => c.name)).toEqual(['Mi unidad', 'Auditoría', '2026'])
    expect(current(loc).id).toBe('B')
    expect(goTo(loc, 1).stack.map(c => c.id)).toEqual(['A'])
    expect(goTo(loc, 0).stack).toEqual([])
  })
  it('una unidad compartida es su propia raíz', () => {
    const loc = rootLocation({ id: 'sd', name: 'Equipo' })
    expect(current(loc)).toEqual({ id: 'sd', name: 'Equipo' })
    expect(breadcrumb(loc)[0].name).toBe('Equipo')
  })
  it('arma los params de browse', () => {
    expect(browseParams(rootLocation(), false)).toEqual({})
    expect(browseParams(enter(rootLocation(), { id: 'A', name: 'A' }), true)).toEqual({ parent: 'A', folders_only: 1 })
    expect(browseParams(rootLocation({ id: 'sd', name: 'E' }), false)).toEqual({ drive_id: 'sd' })
  })
  it('la raíz de Mi unidad no se puede elegir como carpeta; una compartida sí', () => {
    expect(canPickCurrentFolder(rootLocation())).toBe(false)
    expect(canPickCurrentFolder(enter(rootLocation(), { id: 'A', name: 'A' }))).toBe(true)
    expect(canPickCurrentFolder(rootLocation({ id: 'sd', name: 'E' }))).toBe(true)
  })
})

describe('locationFromPath', () => {
  it('abre en una carpeta de Mi unidad', () => {
    const loc = locationFromPath({ id: 'C', name: 'C', drive_id: null }, [{ id: 'root', name: 'Mi unidad' }, { id: 'B', name: 'B' }])
    expect(loc.drive).toBeNull()
    expect(loc.stack.map(c => c.id)).toEqual(['B', 'C'])
  })
  it('abre en una carpeta de una unidad compartida', () => {
    const loc = locationFromPath({ id: 'C', name: 'C', drive_id: 'sd' }, [{ id: 'sd', name: 'Equipo' }])
    expect(loc.drive).toEqual({ id: 'sd', name: 'Equipo' })
    expect(loc.stack.map(c => c.id)).toEqual(['C'])
  })
  it('con ruta parcial (sin acceso a la raíz) apila todo bajo Mi unidad', () => {
    const loc = locationFromPath({ id: 'C', name: 'C', drive_id: null }, [{ id: 'X', name: 'X' }])
    expect(loc.drive).toBeNull()
    expect(loc.stack.map(c => c.id)).toEqual(['X', 'C'])
  })
  it('sin ruta queda en la raíz', () => {
    expect(locationFromPath({ id: 'C', name: 'C', drive_id: null }, [])).toEqual({ drive: null, stack: [{ id: 'C', name: 'C' }] })
  })
})

describe('selección', () => {
  it('filtra por accept con comodines', () => {
    expect(matchesAccept(entry({ mime_type: 'image/png' }), ['image/*'])).toBe(true)
    expect(matchesAccept(entry({ mime_type: 'application/pdf' }), ['image/*'])).toBe(false)
    expect(matchesAccept(entry(), [])).toBe(true)
    expect(matchesAccept(entry({ mime_type: 'application/pdf' }), ['application/pdf'])).toBe(true)
  })
  it('las carpetas solo se seleccionan sin filtro accept', () => {
    expect(isSelectable(entry({ is_folder: true }), [])).toBe(true)
    expect(isSelectable(entry({ is_folder: true }), ['image/*'])).toBe(false)
  })
  it('alterna, respeta single y el máximo', () => {
    const a = entry({ id: 'a' }); const b = entry({ id: 'b' })
    expect(toggleSelection([], a, true).map(e => e.id)).toEqual(['a'])
    expect(toggleSelection([a], a, true)).toEqual([])
    expect(toggleSelection([a], b, false).map(e => e.id)).toEqual(['b'])
    const full = Array.from({ length: MAX_SELECTION }, (_, i) => entry({ id: `i${i}` }))
    expect(toggleSelection(full, b, true)).toHaveLength(MAX_SELECTION)
  })
})
