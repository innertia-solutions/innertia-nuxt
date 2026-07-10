// useApi, useGymStore auto-imported.
// Selección de gym en modo 'open': carga los gyms del usuario y resuelve
// el destino post-login según cuántos tenga (0 / 1 / 2+).

export function useGymSelection() {
  const api = useApi()
  const gym = useGymStore()

  /** Carga los gyms del usuario autenticado y los guarda en el store. */
  async function load() {
    // Shape esperado: { gyms: [{ key, name, status, contexts }] }
    const data = await api.get('auth/my-gyms')
    gym.setGyms(data?.gyms || [])
    return gym.gyms
  }

  /**
   * Resuelve a dónde llevar al usuario tras el login.
   *   'onboarding' → 0 gyms (debe crear/unirse a uno)
   *   'ready'      → 1 gym (auto-seleccionado) o ya tenía uno activo válido
   *   'picker'     → 2+ gyms sin selección válida previa
   */
  async function resolveAfterLogin() {
    await load()
    if (gym.gyms.length === 0) return 'onboarding'
    if (gym.gyms.length === 1) { gym.setActive(gym.gyms[0].key); return 'ready' }
    if (gym.activeKey && gym.gyms.some((g) => g.key === gym.activeKey)) return 'ready'
    return 'picker'
  }

  /** Cambia el gym activo (switcher). */
  function switchTo(key) { gym.setActive(key) }

  return { load, resolveAfterLogin, switchTo }
}
