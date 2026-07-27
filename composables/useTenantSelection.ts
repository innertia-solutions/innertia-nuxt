// useApi, useActiveTenantStore auto-imported.
// Selección de tenant en modo 'open': carga los tenants del usuario y resuelve
// el destino post-login según cuántos tenga (0 / 1 / 2+).

export function useTenantSelection() {
  const api = useApi()
  const store = useActiveTenantStore()

  /** Carga los tenants del usuario autenticado y los guarda en el store. */
  async function load() {
    // El backend aún expone la ruta gym-flavored: { gyms: [{ key, name, status, contexts }] }
    const data = await api.get('auth/my-gyms')
    store.setTenants(data?.gyms || [])
    return store.tenants
  }

  /**
   * Resuelve a dónde llevar al usuario tras el login.
   *   'onboarding' -> 0 tenants (debe crear/unirse a uno)
   *   'ready'      -> 1 tenant (auto-seleccionado) o ya tenia uno activo valido
   *   'picker'     -> 2+ tenants sin seleccion valida previa
   */
  async function resolveAfterLogin() {
    await load()
    if (store.tenants.length === 0) return 'onboarding'
    if (store.tenants.length === 1) { store.setActive(store.tenants[0].key); return 'ready' }
    if (store.activeKey && store.tenants.some((t) => t.key === store.activeKey)) return 'ready'
    return 'picker'
  }

  /** Cambia el tenant activo (switcher). */
  function switchTo(key) { store.setActive(key) }

  return { load, resolveAfterLogin, switchTo }
}
