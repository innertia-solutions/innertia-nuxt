import type { InnertiaMode } from '../app.config'

/**
 * Devuelve el modo activo de la librería: 'saas' | 'app'.
 * Default: 'saas' (compatibilidad con productos existentes).
 *
 * Se configura en `nuxt.config.ts` del producto:
 *   appConfig: { innertia: { mode: 'app' } }
 *
 * Helpers de conveniencia:
 *   isSaas()    → true si mode === 'saas'
 *   isApp()     → true si mode === 'app'
 *   hasTenant() → true si mode === 'saas' (solo saas usa multitenancy)
 */
export function useInnertiaMode() {
  const appConfig = useAppConfig()
  const mode: InnertiaMode = (appConfig.innertia?.mode as InnertiaMode) ?? 'saas'

  return {
    mode,
    isSaas:    () => mode === 'saas',
    isApp:     () => mode === 'app',
    hasTenant: () => mode === 'saas',
  }
}
