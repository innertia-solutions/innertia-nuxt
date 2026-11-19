import { describe, it, expect } from 'vitest'
import {
  apiKeyStatus, deliveryStatus, webhookState, httpSeverity, scopeResource, groupScopes, toggleValue,
  eventMatches, isEventSelected, groupEvents, toggleFamily, toggleEvent, familyState,
  validateWebhookUrl, relativeTime, expiryLabel, expiryFromPreset, appendPage, prettyJson,
} from '../integrations'

const catalog = [
  { key: 'call.ringing' }, { key: 'call.answered' }, { key: 'call.ended' },
  { key: 'person.created' }, { key: 'person.updated' },
]

describe('status labels', () => {
  it('maps key and delivery statuses with fallback', () => {
    expect(apiKeyStatus('active')).toEqual({ label: 'Activa', severity: 'success' })
    expect(apiKeyStatus('revoked').severity).toBe('danger')
    expect(apiKeyStatus('weird').label).toBe('weird')
    expect(deliveryStatus('retrying').label).toBe('Reintentando')
    expect(deliveryStatus(null).label).toBe('—')
  })

  it('derives the webhook state', () => {
    expect(webhookState({ active: false, disabled_at: '2026-11-19T00:00:00Z' }).label).toBe('Desactivado por fallas')
    expect(webhookState({ active: false }).label).toBe('Pausado')
    expect(webhookState({ active: true, failing_since: 'x' }).severity).toBe('warning')
    expect(webhookState({ active: true }).label).toBe('Activo')
  })

  it('colors http statuses', () => {
    expect(httpSeverity(200)).toBe('success')
    expect(httpSeverity(404)).toBe('warning')
    expect(httpSeverity(503)).toBe('danger')
    expect(httpSeverity(null)).toBe('secondary')
  })
})

describe('scopes', () => {
  it('groups by explicit group or resource', () => {
    expect(scopeResource('calls:read')).toBe('calls')
    const g = groupScopes([{ key: 'calls:read' }, { key: 'people:read' }, { key: 'calls:write' }, { key: 'people:pii', group: 'people' }])
    expect(g.map(x => x.group)).toEqual(['calls', 'people'])
    expect(g[0].items.map(i => i.key)).toEqual(['calls:read', 'calls:write'])
    expect(g[1].items).toHaveLength(2)
  })

  it('toggles values without duplicates', () => {
    expect(toggleValue(['a'], 'a', true)).toEqual(['a'])
    expect(toggleValue(['a', 'b'], 'a', false)).toEqual(['b'])
  })
})

describe('event selection with wildcards', () => {
  it('matches patterns', () => {
    expect(eventMatches('*', 'call.ended')).toBe(true)
    expect(eventMatches('call.*', 'call.ended')).toBe(true)
    expect(eventMatches('call.*', 'callback.x')).toBe(false)
    expect(isEventSelected(['person.created'], 'person.updated')).toBe(false)
  })

  it('groups events by family', () => {
    expect(groupEvents(catalog).map(g => [g.family, g.items.length])).toEqual([['call', 3], ['person', 2]])
  })

  it('toggles a family as wildcard', () => {
    expect(toggleFamily(['call.ended', 'person.created'], 'call', true)).toEqual(['person.created', 'call.*'])
    expect(toggleFamily(['call.*', 'person.created'], 'call', false)).toEqual(['person.created'])
  })

  it('expands a wildcard when one event is turned off', () => {
    expect(toggleEvent(['call.*'], 'call.ringing', false, catalog)).toEqual(['call.answered', 'call.ended'])
    expect(toggleEvent(['*'], 'person.updated', false, catalog).sort()).toEqual(['call.*', 'person.created'].sort())
    expect(toggleEvent(['call.*'], 'call.ended', true, catalog)).toEqual(['call.*'])
    expect(toggleEvent([], 'call.ended', true, catalog)).toEqual(['call.ended'])
  })

  it('reports family state', () => {
    expect(familyState(['call.*'], 'call', catalog)).toBe('all')
    expect(familyState(['call.ended'], 'call', catalog)).toBe('some')
    expect(familyState(['person.created', 'person.updated'], 'person', catalog)).toBe('all')
    expect(familyState([], 'person', catalog)).toBe('none')
  })
})

describe('validation and dates', () => {
  it('validates https webhook URLs', () => {
    expect(validateWebhookUrl('')).toMatch(/Ingresa/)
    expect(validateWebhookUrl('http://x.cl/hook')).toMatch(/https/)
    expect(validateWebhookUrl('nope')).toMatch(/no es válida/)
    expect(validateWebhookUrl('https://u:p@x.cl')).toMatch(/credenciales/)
    expect(validateWebhookUrl('https://hooks.example.com/in')).toBeNull()
  })

  it('formats relative times and expiry', () => {
    const now = new Date('2026-11-19T12:00:00Z')
    expect(relativeTime('2026-11-19T11:55:00Z', now)).toBe('hace 5 min')
    expect(relativeTime('2026-11-22T12:00:00Z', now)).toBe('en 3 días')
    expect(relativeTime(null, now)).toBe('—')
    expect(expiryLabel(null, now)).toBe('Sin vencimiento')
    expect(expiryLabel('2026-11-20T12:00:00Z', now)).toBe('Vence en 1 día')
    expect(expiryLabel('2026-11-18T12:00:00Z', now)).toBe('Venció hace 1 día')
    expect(expiryFromPreset('30', now)).toBe('2026-12-19T12:00:00.000Z')
    expect(expiryFromPreset('', now)).toBeNull()
  })

  it('appends cursor pages without duplicates and pretty-prints json', () => {
    expect(appendPage([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]).map(i => i.id)).toEqual([1, 2, 3])
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}')
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(prettyJson('plain')).toBe('plain')
    expect(prettyJson(null)).toBe('')
  })
})
