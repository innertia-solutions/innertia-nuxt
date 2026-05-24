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
     * Branding del producto (nombre + versión). Los logos viven en `/public/isologo-light.png`
     * y `/public/isologo-dark.png` de cada producto — la librería los referencia por path fijo.
     */
    branding: {
      name: 'Innertia',
      version: '1.0.0',
    },

    /**
     * Colores primario y secundario. Acepta:
     *   - Nombre de color de Tailwind (string): 'violet', 'indigo', 'emerald', etc.
     *   - Scale custom (object): { 50: '#f5f3ff', ..., 950: '#2e1065' }
     *
     * El plugin `colors` aplica estos valores a las CSS vars `--primary-{50..950}`
     * y `--secondary-{50..950}` en SSR y cliente.
     */
    colors: {
      primary: 'blue' as ColorOption,
      secondary: 'slate' as ColorOption,
    },

    /**
     * Tono neutral usado en modo dark (backgrounds, borders, surfaces).
     * Cambia el "feel" del modo oscuro sin tocar el color de marca.
     *
     *   - 'neutral' (default) → gris puro, neutral
     *   - 'slate'             → gris con leve tinte azul (más frío)
     *   - 'gray'              → gris levemente más cálido que slate
     *   - 'zinc'              → gris cálido
     *   - 'stone'             → gris muy cálido (con tinte tierra)
     */
    darkTone: 'neutral' as DarkTone,

    /**
     * Contenido del panel marketing del layout `auth`. Si no se declara, el panel queda vacío.
     */
    marketing: {
      /** Palabras del typewriter. Vacío = sin typewriter (muestra heading estático). */
      words: [] as string[],
      /** Tagline mostrada después del typewriter. Soporta `\n` para saltos de línea. */
      tagline: '',
      /** Descripción debajo del tagline. */
      description: '',
      /** Footer con lista de items (ej. normas, certificaciones, integraciones). */
      footer: {
        title: '',
        items: [] as string[],
        description: '',
      },
    },

    /**
     * Proveedores OAuth para modo `app`. En modo `saas` se ignora — la lista viene
     * de `tenantStore.config.oauth` que se carga por SSR desde el backend.
     */
    oauth: [] as OAuthProvider[],

    /**
     * Items principales del menú del layout `backoffice`.
     * Cada item: { label, icon ('IconName' de @tabler/icons-vue), route, pattern? }.
     */
    menu: [] as MenuItem[],

    /**
     * Items secundarios del menú backoffice (apps / módulos). Renderizan junto a `menu`
     * pero permiten diferenciar visualmente en el futuro (ej. sub-secciones modulares).
     */
    menuApps: [] as MenuItem[],

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

/** Color: nombre de paleta Tailwind o scale custom 50→950. */
export type ColorScale = Partial<Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>>
export type ColorOption = string | ColorScale

/** Tono neutral usado en modo dark — debe ser una paleta gris de Tailwind. */
export type DarkTone = 'neutral' | 'slate' | 'gray' | 'zinc' | 'stone'

/** Proveedor OAuth — slug del provider (matchea con backend SocialAuthController). */
export type OAuthProvider = 'google' | 'microsoft' | 'apple' | 'github'

/** Item de menú del layout backoffice. */
export interface MenuItem {
  label: string
  /** Nombre de icono de @tabler/icons-vue (con prefijo Icon). Ej: 'IconHome'. */
  icon: string
  route: string
  /** Pattern (glob style con `*`) para resaltar item activo. Si no se pasa, usa route. */
  pattern?: string
}

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
