/**
 * Composable de organizaciones (sub-tenant scoping).
 *
 * Lee el contexto actual del usuario (via useApp) y expone su org activa + lista
 * de accesibles para ese contexto. Cambiar de contexto rota la org automáticamente.
 *
 * Uso típico:
 *   const { current, available, needsPicker, switchTo } = useOrganization()
 *
 *   <OrganizationSwitcher v-if="available.length > 1" />
 */
export function useOrganization() {
  const { current: currentApp } = useContext()
  const organizationStore = useOrganizationStore()
  const appConfig = useAppConfig()
  const { fetchMe } = useAuth()

  const isEnabled = computed(() => !!appConfig.innertia?.organizations?.enabled)
  const allowConsolidated = computed(() => !!appConfig.innertia?.organizations?.allowConsolidated)
  const required = computed(() => !!appConfig.innertia?.organizations?.required)

  /** Contexto actual (key) — desde useApp. */
  const currentContext = computed<string | null>(() => currentApp.value?.context ?? null)

  /** Lista de orgs accesibles para el contexto actual. */
  const available = computed(() => {
    if (!currentContext.value) return []
    return organizationStore.availableFor(currentContext.value)
  })

  /** Org actual (object completo) para el contexto. */
  const current = computed(() => {
    if (!currentContext.value) return null
    return organizationStore.currentObjectFor(currentContext.value)
  })

  /** Slug de la org actual (útil para headers, comparaciones). */
  const currentSlug = computed(() => current.value?.key ?? null)

  /** ¿Hay que mostrar picker? */
  const needsPicker = computed(() => {
    if (!isEnabled.value) return false
    if (!currentContext.value) return false
    return organizationStore.needsPickerFor(currentContext.value)
  })

  /** ¿El user tiene 0 orgs en este contexto Y el feature requiere org? */
  const blocked = computed(() => {
    if (!isEnabled.value || !required.value) return false
    if (!currentContext.value) return false
    return available.value.length === 0
  })

  /** Toggle vista consolidada (solo si está permitida globalmente). */
  const consolidated = computed({
    get: () => allowConsolidated.value && organizationStore.consolidated,
    set: (v) => organizationStore.setConsolidated(v),
  })

  /**
   * Cambia la org actual del contexto. Re-fetcha auth/me para refrescar permisos
   * scopeados al backend con la nueva org.
   */
  async function switchTo(slug: string) {
    if (!currentContext.value) return
    organizationStore.setCurrent(currentContext.value, slug)
    try {
      await fetchMe()
    } catch {
      // best-effort
    }
  }

  /** Auto-select de la org si solo hay 1 disponible. Llamar al montar layouts. */
  function autoSelect() {
    if (!currentContext.value || !isEnabled.value) return
    organizationStore.autoSelectFor(currentContext.value)
  }

  return {
    isEnabled,
    allowConsolidated,
    required,
    currentContext,
    available,
    current,
    currentSlug,
    needsPicker,
    blocked,
    consolidated,
    switchTo,
    autoSelect,
  }
}
