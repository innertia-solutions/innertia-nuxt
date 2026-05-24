import type { AppDefinition } from '../app.config'

/**
 * Devuelve metadata del app actual + listas filtradas por permisos del usuario.
 * Lee la declaración de apps desde `appConfig.innertia.apps` (configurable por
 * el producto en su `nuxt.config.ts`).
 *
 * Uso típico:
 *   const { current, accessible } = useApp()
 *   <h1>Estás en: {{ current?.label }}</h1>
 */
export function useApp() {
  const route = useRoute()
  const authStore = useAuthStore()
  const appConfig = useAppConfig()

  /** Diccionario de apps declarados por el producto. */
  const apps = computed<Record<string, AppDefinition>>(() =>
    (appConfig.innertia?.apps ?? {}) as Record<string, AppDefinition>
  )

  /** Todos los apps declarados, en orden de declaración. */
  const all = computed<AppDefinition[]>(() => Object.values(apps.value))

  /** App actual, determinado por el prefijo de la ruta. `null` si la URL no cae en ningún app. */
  const current = computed<AppDefinition | null>(() => {
    return all.value.find(app =>
      route.path === app.path || route.path.startsWith(app.path + '/')
    ) ?? null
  })

  /** Apps a los que el usuario autenticado tiene acceso (filtrado por `availableContexts`). */
  const accessible = computed<AppDefinition[]>(() => {
    const ctxs = (authStore.availableContexts ?? []) as string[]
    return all.value.filter(app => ctxs.includes(app.context))
  })

  /** Helper: ¿el usuario puede acceder a este app? */
  function canAccess(appKey: string): boolean {
    const app = apps.value[appKey]
    if (!app) return false
    return ((authStore.availableContexts ?? []) as string[]).includes(app.context)
  }

  return { current, all, accessible, canAccess, apps }
}
