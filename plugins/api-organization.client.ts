/**
 * Registra el interceptor del header X-Organization.
 *
 * Se envía cuando:
 *   - `appConfig.innertia.organizations.enabled === true`
 *   - El user tiene una org activa para el contexto actual
 *
 * También inyecta `X-Consolidated: true` si el store tiene `consolidated === true`
 * (toggle global, ej. desde un OrganizationSwitcher). Para llamadas one-off
 * consolidadas en código, usar `useApiConsolidatedOrganizations()` que inyecta
 * el header por-request sin afectar el toggle global.
 *
 * Solo activo cuando `mode === 'saas'` (orgs viven dentro de un tenant).
 */
export default defineNuxtPlugin(() => {
  const { hasTenant } = useInnertiaMode()
  if (!hasTenant()) return

  const appConfig = useAppConfig()
  if (!appConfig.innertia?.organizations?.enabled) return

  const { add } = useRequestInterceptors()
  const organizationStore = useOrganizationStore()
  const { currentContext } = useOrganization()

  add((headers: Record<string, string>) => {
    const ctx = currentContext.value
    if (!ctx) return

    const slug = organizationStore.currentFor(ctx)
    if (slug) headers['X-Organization'] = slug

    if (organizationStore.consolidated) {
      headers['X-Consolidated'] = 'true'
    }
  })
})
