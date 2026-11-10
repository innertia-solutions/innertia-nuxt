import { describe, it, expect } from 'vitest'
import { historyParams, groupByDay, timeAgo, defaultNotificationLink } from '../format'

const now = new Date('2026-11-10T15:00:00')

describe('historyParams', () => {
  it('pide todas (all=1) con página y tamaño', () => {
    expect(historyParams({ filter: 'all', page: 2, perPage: 20 })).toEqual({ all: 1, page: 2, per_page: 20 })
  })
  it('para no leídas omite all (el backend filtra por defecto)', () => {
    expect(historyParams({ filter: 'unread', page: 1, perPage: 20 })).toEqual({ page: 1, per_page: 20 })
  })
})

describe('groupByDay', () => {
  it('agrupa en Hoy / Ayer / fecha, preservando el orden', () => {
    const items = [
      { id: 'a', created_at: '2026-11-10T14:00:00' },
      { id: 'b', created_at: '2026-11-10T09:00:00' },
      { id: 'c', created_at: '2026-11-09T20:00:00' },
      { id: 'd', created_at: '2026-10-01T10:00:00' },
    ]
    const groups = groupByDay(items, now)
    expect(groups.map(g => g.label)).toEqual(['Hoy', 'Ayer', expect.stringContaining('oct')])
    expect(groups[0].items.map(i => i.id)).toEqual(['a', 'b'])
    expect(groups[2].items.map(i => i.id)).toEqual(['d'])
  })
  it('sin fecha cae en un grupo "Sin fecha"', () => {
    expect(groupByDay([{ id: 'x' }], now)[0].label).toBe('Sin fecha')
  })
})

describe('timeAgo', () => {
  it('formatea relativo en español', () => {
    expect(timeAgo('2026-11-10T14:59:30', now)).toBe('hace un momento')
    expect(timeAgo('2026-11-10T14:45:00', now)).toBe('hace 15 min')
    expect(timeAgo('2026-11-10T12:00:00', now)).toBe('hace 3 h')
    expect(timeAgo('2026-11-08T15:00:00', now)).toBe('hace 2 d')
  })
  it('vacío sin fecha', () => {
    expect(timeAgo(null, now)).toBe('')
  })
})

describe('defaultNotificationLink', () => {
  it('usa data.link, luego data.url, si no null', () => {
    expect(defaultNotificationLink({ data: { link: '/a', url: '/b' } })).toBe('/a')
    expect(defaultNotificationLink({ data: { url: '/b' } })).toBe('/b')
    expect(defaultNotificationLink({ data: null })).toBeNull()
  })
})
