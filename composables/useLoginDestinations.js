// useTenantSelection, useActiveTenantStore, useAppConfig auto-imported.
//
// Modo 'open' — login personal unificado.
//
// Tras autenticar NO conocemos el tenant ni el rol: la fuente de verdad es
// `auth/my-gyms`, que devuelve tenants:[{key,name,status,contexts}] — un tenant
// puede otorgar varios contextos (p.ej. backoffice + student = 2 destinos).
//
// Expande esos tenants en una lista plana de "destinos" (tenant × contexto) para
// rutear post-login:
//   0 destinos -> onboarding
//   1 destino  -> entrar directo (fija tenant activo + navega a home del contexto)
//   2+         -> selector
//
// Los contextos que participan del login personal se declaran por producto en
// `appConfig.innertia.personalContexts` (p.ej. ['backoffice','student','coach']).
// Un contexto con login dedicado (p.ej. kiosco 'attendance') NO debe listarse ahí.

export function useLoginDestinations() {
  const { load } = useTenantSelection()
  const store = useActiveTenantStore()
  const appConfig = useAppConfig()

  const personalContexts = () => appConfig.innertia?.personalContexts ?? []
  const contextDefs = () => appConfig.innertia?.contexts ?? {}

  /** Home de un contexto (según app.config), con fallback razonable. */
  function homeFor(context) {
    const def = Object.values(contextDefs()).find((c) => c.context === context)
    return def?.home || `/${context}`
  }

  /** Label legible de un contexto. */
  function labelFor(context) {
    const def = Object.values(contextDefs()).find((c) => c.context === context)
    return def?.label || context
  }

  /**
   * Carga los tenants del usuario y los expande a destinos tenant×contexto.
   * Devuelve { destinations, tenants }.
   *   destination = { tenantKey, tenantName, tenantStatus, context, contextLabel, home }
   */
  async function resolve() {
    await load() // rellena store.tenants desde auth/my-gyms
    const tenants = store.tenants || []

    const destinations = []
    for (const tenant of tenants) {
      const ctxs = (tenant.contexts || []).filter((c) => personalContexts().includes(c))
      for (const context of ctxs) {
        destinations.push({
          tenantKey: tenant.key,
          tenantName: tenant.name || tenant.key,
          tenantStatus: tenant.status,
          context,
          contextLabel: labelFor(context),
          home: homeFor(context),
        })
      }
    }

    return { destinations, tenants }
  }

  /** Fija el tenant + contexto activos y navega a la home del contexto elegido. */
  async function go(destination) {
    store.setActive(destination.tenantKey)
    store.setActiveContext(destination.context)
    await navigateTo(destination.home)
  }

  return { resolve, go, homeFor, labelFor }
}
