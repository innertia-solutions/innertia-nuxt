import { describe, it, expect } from 'vitest'
import { publicVersion, frontendDetails } from '../version'

const cfg = {
  app: 'acme-front', version: '1.2.3', commit: '0123456789abcdef', buildDate: '2026-11-04T10:00:00Z',
  packages: { nuxt: '4.4.6', vue: '3.5.34' }, detailsPath: 'platform/version',
}

describe('publicVersion', () => {
  it('expone solo los 5 campos, commit corto, sin dependencias', () => {
    const v = publicVersion(cfg, { APP_ENV: 'staging' })
    expect(Object.keys(v)).toEqual(['app', 'version', 'commit', 'build_date', 'environment'])
    expect(v).toEqual({ app: 'acme-front', version: '1.2.3', commit: '0123456', build_date: '2026-11-04T10:00:00Z', environment: 'staging' })
    expect(JSON.stringify(v)).not.toContain('4.4.6')
  })

  it('commit vacío → null; environment cae a NODE_ENV', () => {
    const v = publicVersion({ ...cfg, commit: '' }, { NODE_ENV: 'production' })
    expect(v.commit).toBeNull()
    expect(v.environment).toBe('production')
  })
})

describe('frontendDetails', () => {
  it('agrega runtime node y paquetes', () => {
    const d = frontendDetails(cfg, { APP_ENV: 'local' }, 'v22.12.0')
    expect(d.runtime).toEqual({ node: 'v22.12.0' })
    expect(d.packages).toEqual({ nuxt: '4.4.6', vue: '3.5.34' })
    expect(d.commit).toBe('0123456')
  })
})
