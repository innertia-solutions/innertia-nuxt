// useAuthStore, useApi, useAuth, useRoute, useAppConfig auto-imported
import { computed } from 'vue'
import type { ContextDefinition } from '../app.config'

export function useContext() {
  const route = useRoute()
  const authStore = useAuthStore()
  const appConfig = useAppConfig()
  const api = useApi()
  const { fetchMe } = useAuth()

  // ── Config-level: definiciones declaradas en appConfig.innertia.contexts ───

  /** Diccionario de contextos declarados por el producto. */
  const contexts = computed<Record<string, ContextDefinition>>(() =>
    (appConfig.innertia?.contexts ?? {}) as Record<string, ContextDefinition>
  )

  /** Todos los contextos declarados, en orden de declaración. */
  const all = computed<ContextDefinition[]>(() => Object.values(contexts.value))

  /** Contexto actual según URL. `null` si la URL no cae en ningún contexto declarado. */
  const current = computed<ContextDefinition | null>(() => {
    return all.value.find(ctx =>
      route.path === ctx.path || route.path.startsWith(ctx.path + '/')
    ) ?? null
  })

  /** Contextos a los que el usuario autenticado tiene acceso (filtrado por `availableContexts`). */
  const accessible = computed<ContextDefinition[]>(() => {
    const ctxs = (authStore.availableContexts ?? []) as string[]
    return all.value.filter(ctx => ctxs.includes(ctx.context))
  })

  /** Helper: ¿el usuario puede acceder a este contexto (por clave de config)? */
  function canAccess(key: string): boolean {
    const ctx = contexts.value[key]
    if (!ctx) return false
    return ((authStore.availableContexts ?? []) as string[]).includes(ctx.context)
  }

  // ── Runtime: contexto activo + switching ───────────────────────────────────

  const currentContext = computed(() => authStore.currentContext)
  const availableContexts = computed(() => authStore.availableContexts)

  /**
   * Check whether user has permission to switch to targetContext.
   * Returns:
   *   { success: false, reason: 'no_permission' }  — user cannot switch
   *   { success: true, requiresConfirmation: true } — show confirmation UI
   */
  async function switchContext(targetContext: string) {
    const data = await api.get(`auth/context/${targetContext}/check`)
    if (!data.hasAccess) {
      return { success: false, reason: 'no_permission' }
    }
    return { success: true, requiresConfirmation: true }
  }

  /**
   * Execute the context switch after user confirmation.
   * Updates store and reloads permissions via fetchMe.
   */
  async function confirmSwitch(targetContext: string) {
    authStore.setCurrentContext(targetContext)
    await fetchMe()
    return { success: true }
  }

  /**
   * Quick synchronous check — is this context in the available list?
   */
  function hasAccessToContext(context: string) {
    return authStore.availableContexts.includes(context)
  }

  return {
    // config-level
    contexts,
    all,
    current,
    accessible,
    canAccess,
    // runtime
    currentContext,
    availableContexts,
    switchContext,
    confirmSwitch,
    hasAccessToContext,
  }
}
