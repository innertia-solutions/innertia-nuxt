import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectBuildVersion, readPackageVersions } from '../version'

let root: string

function pkg(dir: string, json: Record<string, unknown>) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(json))
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'innertia-version-'))
  pkg(root, { name: 'acme-front', version: '1.2.3' })
  pkg(join(root, 'node_modules', 'nuxt'), { name: 'nuxt', version: '4.4.6' })
  pkg(join(root, 'node_modules', 'vue'), { name: 'vue', version: '3.5.34' })
  pkg(join(root, 'node_modules', '@innertia-solutions', 'innertia-nuxt'), { name: '@innertia-solutions/innertia-nuxt', version: '0.1.66' })
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('readPackageVersions', () => {
  it('lee versiones instaladas y omite las ausentes', () => {
    expect(readPackageVersions(root, ['nuxt', 'vue', '@innertia-solutions/innertia-nuxt', 'no-existe']))
      .toEqual({ nuxt: '4.4.6', vue: '3.5.34', '@innertia-solutions/innertia-nuxt': '0.1.66' })
  })
})

describe('collectBuildVersion', () => {
  it('usa APP_COMMIT/APP_BUILD_DATE/APP_VERSION del entorno de build', () => {
    const v = collectBuildVersion(root, {
      APP_COMMIT: 'abcdef1234567890', APP_BUILD_DATE: '2026-11-04T10:00:00Z', APP_VERSION: '9.9.9',
    }, { git: false })
    expect(v).toMatchObject({ app: 'acme-front', version: '9.9.9', commit: 'abcdef1234567890', buildDate: '2026-11-04T10:00:00Z' })
    expect(v.packages.nuxt).toBe('4.4.6')
  })

  it('cae al package.json del producto y a la fecha actual', () => {
    const v = collectBuildVersion(root, {}, { git: false })
    expect(v.version).toBe('1.2.3')
    expect(v.commit).toBe('')
    expect(Number.isNaN(Date.parse(v.buildDate))).toBe(false)
  })
})
