import { describe, it, expect } from 'vitest'
import { parseVersion, versionLabel } from '../version-string'

describe('parseVersion', () => {
  it('prod', () => {
    expect(parseVersion('v1.0.2-20261111.2')).toEqual({
      raw: 'v1.0.2-20261111.2', semver: '1.0.2', date: '2026-11-11', environment: 'production', sequence: 2,
    })
  })
  it('QA', () => {
    expect(parseVersion('v1.0.2-20261111-QA.7')).toEqual({
      raw: 'v1.0.2-20261111-QA.7', semver: '1.0.2', date: '2026-11-11', environment: 'qa', sequence: 7,
    })
  })
  it('dev', () => {
    expect(parseVersion('v1.0.2-dev')).toEqual({
      raw: 'v1.0.2-dev', semver: '1.0.2', date: null, environment: 'dev', sequence: null,
    })
  })
  it.each([null, undefined, '', '1.0.2', 'v.1.0.2-20261111.2', 'v1.0.2-20261111', 'v1.0.2-20261111-qa.1'])(
    'null si no calza: %s', (raw) => {
      expect(parseVersion(raw as any)).toBeNull()
    })
})

describe('versionLabel', () => {
  it('formatea prod, QA y dev', () => {
    expect(versionLabel('v1.0.2-20261111.2')).toBe('v1.0.2 · #2')
    expect(versionLabel('v1.0.2-20261111-QA.7')).toBe('v1.0.2 · QA #7')
    expect(versionLabel('v1.0.2-dev')).toBe('v1.0.2 · dev')
  })
  it('devuelve el string crudo si no calza, vacío si no hay', () => {
    expect(versionLabel('1.4.0')).toBe('1.4.0')
    expect(versionLabel(null)).toBe('')
  })
})
