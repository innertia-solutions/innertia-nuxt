// Defaults para `appConfig.innertia`. Los productos sobreescriben esto en su nuxt.config.ts:
//
//   appConfig: {
//     innertia: {
//       apps: { backoffice: {...}, technician: {...} },
//       mobile: { breakpoint: 1024 },
//     },
//   }
//
// Si el producto no declara `apps`, el feature de contextos queda inactivo
// (middleware no redirige, picker no se muestra).
export default defineAppConfig({
  innertia: {
    /**
     * Modo de operación:
     *   - 'saas' → multi-tenant. Activa detect-subdomain, validate-tenant y X-Tenant header.
     *              Default por compatibilidad con productos existentes.
     *   - 'app'  → single-tenant / app interna. No detecta subdomain ni inyecta tenant header.
     *              Auth y contextos siguen funcionando igual que en saas.
     */
    mode: 'saas' as InnertiaMode,

    /**
     * Declaración de "apps" (contextos) del producto.
     * Cada app define un prefijo de URL que mapea a un contexto del backend
     * (matching con `availableContexts` que devuelve `auth/me`).
     */
    apps: {} as Record<string, AppDefinition>,

    /**
     * Política mobile global. Se aplica si una `app` no tiene `mobile.mode` propio.
     */
    mobile: {
      /** Threshold de viewport en px para considerar mobile (default 1024 = Tailwind `lg`). */
      breakpoint: 1024,
      /** Persistir elección del picker en cookie. */
      rememberChoice: true,
    },
  },
})

// ─── Tipos públicos ──────────────────────────────────────────────────────────
// Re-exportados desde acá para que cualquier composable / componente los importe.

export type InnertiaMode = 'saas' | 'app'

export type AppMobileMode = 'allow' | 'block' | 'redirect'

export interface AppDefinition {
  /** Prefijo de URL — la ruta debe empezar con esto para considerarse "dentro" del app. */
  path: string
  /** Clave del contexto que matchea con `availableContexts` del backend. */
  context: string
  /** Label visible en pickers, dropdowns, etc. */
  label: string
  /** Descripción opcional para el picker mobile. */
  description?: string
  /** Nombre del icono de @tabler/icons-vue (sin "Icon"). */
  icon?: string
  /** Ruta de login del app. */
  loginPath: string
  /** Ruta home (post-login). */
  home: string
  /** Política de uso en mobile. */
  mobile: {
    mode: AppMobileMode
    /** Solo si mode === 'redirect' — adónde mandar desde mobile. */
    redirectTo?: string
  }
}
