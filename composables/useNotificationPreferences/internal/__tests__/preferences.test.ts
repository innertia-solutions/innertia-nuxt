import { describe, it, expect } from 'vitest'
import { clonePreferences, diffPreferences, groupByCategory, togglePreference, type NoticeTypePreference } from '../preferences'

const state = (enabled: boolean, locked = false, available = true) => ({ enabled, locked, available })
const data: NoticeTypePreference[] = [
  { key: 'call.missed', label: 'Llamada perdida', critical: false, category: null, channels: ['bell'], preferences: { bell: state(true), mail: state(false) } },
  { key: 'account.password_changed', label: 'Contraseña cambiada', critical: true, category: 'account', channels: ['bell', 'mail'], preferences: { bell: state(true, true), mail: state(true, true) } },
]

describe('preferencias de avisos', () => {
  it('cambia un canal sin mutar lo que vino del servidor', () => {
    const items = clonePreferences(data)
    const next = togglePreference(items, 'call.missed', 'mail', true)
    expect(next[0].preferences.mail.enabled).toBe(true)
    expect(data[0].preferences.mail.enabled).toBe(false)
  })

  it('los críticos están bloqueados: no cambian ni se envían', () => {
    const next = togglePreference(clonePreferences(data), 'account.password_changed', 'mail', false)
    expect(next[1].preferences.mail.enabled).toBe(true)
    expect(diffPreferences(data, next)).toEqual([])
  })

  it('diff devuelve solo lo cambiado', () => {
    let items = togglePreference(clonePreferences(data), 'call.missed', 'bell', false)
    items = togglePreference(items, 'call.missed', 'mail', true)
    expect(diffPreferences(data, items)).toEqual([
      { type: 'call.missed', channel: 'bell', enabled: false },
      { type: 'call.missed', channel: 'mail', enabled: true },
    ])
    expect(diffPreferences(data, togglePreference(items, 'call.missed', 'bell', true))).toEqual([
      { type: 'call.missed', channel: 'mail', enabled: true },
    ])
  })

  it('agrupa por categoría', () => {
    expect(groupByCategory(data).map(g => g.label)).toEqual(['Avisos', 'Cuenta y seguridad'])
  })
})
