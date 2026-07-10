import type { InnertiaMode } from '../app.config'

/**
 * Devuelve el modo activo de la librería: 'saas' | 'app' | 'open'.
 * Default: 'saas' (compatibilidad con productos existentes).
 *
 * Se configura en `nuxt.config.ts` del producto:
 *   appConfig: { innertia: { mode: 'app' } }
 *
 * Helpers de conveniencia:
 *   isSaas()    → true si mode === 'saas'
 *   isApp()     → true si mode === 'app'
 *   isOpen()    → true si mode === 'open'
 *   hasTenant() → true si mode === 'saas' | 'open' (usan multitenancy;
 *                 saas resuelve por subdominio, open por gym seleccionado)
 */
export function useInnertiaMode() {
  const appConfig = useAppConfig()
  const mode: InnertiaMode = (appConfig.innertia?.mode as InnertiaMode) ?? 'saas'

  return {
    mode,
    isSaas:    () => mode === 'saas',
    isApp:     () => mode === 'app',
    isOpen:    () => mode === 'open',
    hasTenant: () => mode === 'saas' || mode === 'open',
  }
}
