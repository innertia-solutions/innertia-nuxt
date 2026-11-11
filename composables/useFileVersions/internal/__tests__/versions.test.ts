import { describe, it, expect } from 'vitest'
import { versionEndpoints, versionSourceLabel, formatBytes, versionResultMessage } from '../versions'

describe('versiones', () => {
  it('arma endpoints bajo el prefijo de Files', () => {
    const ep = versionEndpoints('platform/files', 'f 1')
    expect(ep.list).toBe('platform/files/f%201/versions')
    expect(ep.restore(3)).toBe('platform/files/f%201/versions/3/restore')
    expect(ep.contents).toBe('platform/files/f%201/contents')
  })
  it('etiqueta el origen', () => {
    expect(versionSourceLabel('upload')).toBe('Subida')
    expect(versionSourceLabel('replace')).toBe('Reemplazo')
    expect(versionSourceLabel('provider_import')).toBe('Desde Drive')
    expect(versionSourceLabel('provider_refresh')).toBe('Actualizada desde Drive')
    expect(versionSourceLabel('restore', 2)).toBe('Restaurada desde v2')
    expect(versionSourceLabel('restore', null)).toBe('Restaurada')
    expect(versionSourceLabel('otro' as any)).toBe('Versión')
  })
  it('formatea tamaños', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1048576)).toBe('5.0 MB')
    expect(formatBytes(null)).toBe('—')
  })
  it('mensajes de resultado', () => {
    expect(versionResultMessage({ status: 'created', file: { version: 4 } })).toBe('Nueva versión v4 creada.')
    expect(versionResultMessage({ status: 'unchanged', file: { version: 3 } })).toBe('Sin cambios: el contenido es igual a la versión vigente.')
  })
})
