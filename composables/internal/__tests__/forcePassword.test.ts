import { describe, it, expect } from 'vitest'
import { resolveForcePasswordRedirect } from '../forcePassword'

const pending = { force_password_change: true }
const on = { enabled: true }

describe('force-password', () => {
  it('apagado por defecto: nunca redirige', () => {
    expect(resolveForcePasswordRedirect('/backoffice', pending, undefined)).toBeNull()
    expect(resolveForcePasswordRedirect('/backoffice', pending, { enabled: false })).toBeNull()
  })

  it('con cambio pendiente lleva a la página de cambio del área', () => {
    expect(resolveForcePasswordRedirect('/backoffice/users', pending, on)).toBe('/backoffice/auth/change-password')
  })

  it('deja pasar las rutas de auth y la propia página de cambio', () => {
    expect(resolveForcePasswordRedirect('/backoffice/auth/change-password', pending, on)).toBeNull()
    expect(resolveForcePasswordRedirect('/backoffice/auth/login', pending, on)).toBeNull()
  })

  it('sin cambio pendiente o fuera del área no hace nada', () => {
    expect(resolveForcePasswordRedirect('/backoffice', { force_password_change: false }, on)).toBeNull()
    expect(resolveForcePasswordRedirect('/portal', pending, on)).toBeNull()
    expect(resolveForcePasswordRedirect('/backoffice-x', pending, on)).toBeNull()
  })

  it('rutas configurables por área, el prefijo más largo gana', () => {
    const cfg = { enabled: true, routes: { '/backoffice': '/backoffice/auth/change-password', '/technician': '/technician/password' }, allow: ['/technician/password', '/backoffice/auth/'] }
    expect(resolveForcePasswordRedirect('/technician/agenda', pending, cfg)).toBe('/technician/password')
    expect(resolveForcePasswordRedirect('/technician/password', pending, cfg)).toBeNull()
  })

  it('/platform lo maneja su propio middleware', () => {
    expect(resolveForcePasswordRedirect('/platform/users', { ...pending, is_platform_admin: true }, { enabled: true, routes: { '/platform': '/x' } })).toBeNull()
  })
})
