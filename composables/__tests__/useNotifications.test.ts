import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls: string[] = []
const api = {
  get: vi.fn(async (url: string) => { calls.push(`GET ${url}`); return { data: [], unread: 0 } }),
  patch: vi.fn(async (url: string) => { calls.push(`PATCH ${url}`) }),
  delete: vi.fn(async (url: string) => { calls.push(`DELETE ${url}`) }),
}
const store = { setNotifications: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(), remove: vi.fn() }
vi.stubGlobal('useApi', () => api)
vi.stubGlobal('useNotificationsStore', () => store)

const { useNotifications } = await import('../useNotifications.js')

describe('useNotifications (campanita)', () => {
  beforeEach(() => { calls.length = 0 })

  it('por defecto habla con notifications (backoffice)', async () => {
    const n = useNotifications()
    await n.fetchNotifications({ all: 1 })
    await n.markAsRead('a')
    expect(calls).toEqual(['GET notifications', 'PATCH notifications/a/read'])
  })

  it('en platform usa el endpoint configurado', async () => {
    const n = useNotifications({ base: '/platform/notifications/' })
    await n.fetchNotifications()
    await n.markAllAsRead()
    await n.remove('b')
    expect(calls).toEqual(['GET platform/notifications', 'PATCH platform/notifications/read-all', 'DELETE platform/notifications/b'])
  })
})
