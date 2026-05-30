// Defaults para `appConfig.innertia`. Los productos sobreescriben esto en su nuxt.config.ts:
//
//   appConfig: {
//     innertia: {
//       contexts: { backoffice: {...}, technician: {...} },
//       mobile: { breakpoint: 1024 },
//     },
//   }
//
// Si el producto no declara `contexts`, el feature de contextos queda inactivo
// (middleware no redirige, picker no se muestra).
export default defineAppConfig({
  innertia: {
    /**
     * Modo de operación:
     *   - 'saas' → multi-tenant. Activa detect-subdomain, validate-tenant y X-Tenant header.
     *              Default por compatibilidad con productos existentes.
     *   - 'app'  → single-tenant / app interna. No detecta subdomain ni inyecta tenant header.
     *              Auth y contextos siguen funcionando igual que en saas.
     *
     * IMPORTANTE: se deja `undefined` a propósito (no hardcodear 'saas' aquí).
     * Nuxt mergea `app.config.ts` de la capa CON MAYOR prioridad que el bloque
     * `appConfig` del `nuxt.config.ts` del producto (defuFn(cfg_capa, inlineConfig)).
     * Si pusiéramos un valor concreto, el producto no podría cambiarlo desde su
     * nuxt.config. Con `undefined`, defu deja pasar el valor del producto y el
     * default real ('saas') lo aplica `useInnertiaMode()` vía `?? 'saas'`.
     */
    mode: undefined as InnertiaMode | undefined,

    /**
     * Branding del producto (nombre + versión). Los logos viven en `/public/isologo-light.png`
     * y `/public/isologo-dark.png` de cada producto — la librería los referencia por path fijo.
     */
    branding: {
      name: 'Innertia',
      version: '1.0.0',
    },

    /**
     * Tema Preline. Cada tema define el "feel" completo (paleta neutral, fondos,
     * bordes, sombras) tanto en light como en dark mode. Es el equivalente a
     * "darkTone" pero más expresivo — distintos temas tienen distintos tonos.
     *
     * Cada tema viene con un brand color default (puedes overridearlo con `colors.primary`):
     *   - 'default'   → blue   (neutral, profesional)
     *   - 'harvest'   → amber  (cálido, tierra)
     *   - 'retro'     → fuchsia (vibrante, ochenta)
     *   - 'ocean'     → cyan   (frío, acuático)
     *   - 'autumn'    → yellow (otoñal)
     *   - 'moon'      → gray   (gris, dark-friendly elegante)
     *   - 'bubblegum' → pink   (suave, juvenil)
     *   - 'cashmere'  → mauve  (cálido morado)
     *   - 'olive'     → avocado (verde tierra)
     *
     * Ver https://preline.co/docs/themes.html para preview de cada uno.
     */
    theme: 'default' as PrelineTheme,

    /**
     * Colores primario y secundario. Overridean el brand color default del tema.
     * Acepta:
     *   - Nombre de color de Tailwind (string): 'violet', 'indigo', 'emerald', etc.
     *   - Scale custom (object): { 50: '#f5f3ff', ..., 950: '#2e1065' }
     *
     * Si no se declara, se usa el brand color default del `theme` elegido.
     *
     * El plugin `colors` aplica estos valores a las CSS vars `--primary-{50..950}`
     * y `--secondary-{50..950}` en SSR y cliente.
     */
    colors: {
      primary: undefined as ColorOption | undefined,
      secondary: undefined as ColorOption | undefined,
    },

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
     * Soporte de organizaciones (sub-tenant scoping).
     * Debe matchear con `innertia.organizations.enabled` del backend.
     *
     * Cuando está activo:
     *   - El interceptor agrega `X-Organization: <slug>` a cada request
     *   - Al entrar a un contexto, si el usuario tiene 2+ orgs y no hay elegida → picker
     *   - Si tiene 1 org → auto-select
     *   - La elección se persiste por contexto en cookie (30 días)
     */
    organizations: {
      /** Activar feature. Default false. */
      enabled: false,
      /** Si true, los productos pueden exponer toggle "vista consolidada" (X-Consolidated header). */
      allowConsolidated: false,
      /** Si true, bloquea el contexto cuando el user tiene 0 orgs accesibles. Default false (deja pasar). */
      required: false,
    },

    /**
     * Declaración de contextos del producto.
     * Cada contexto define un prefijo de URL que mapea a un contexto del backend
     * (matching con `availableContexts` que devuelve `auth/me`).
     */
    contexts: {} as Record<string, ContextDefinition>,

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

export type ContextMobileMode = 'allow' | 'block' | 'redirect'

/** Color: nombre de paleta Tailwind o scale custom 50→950. */
export type ColorScale = Partial<Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>>
export type ColorOption = string | ColorScale

/** Temas Preline disponibles — cada uno define un "feel" completo (light + dark). */
export type PrelineTheme =
  | 'default'    // blue
  | 'harvest'    // amber
  | 'retro'      // fuchsia
  | 'ocean'      // cyan
  | 'autumn'     // yellow
  | 'moon'       // gray
  | 'bubblegum'  // pink
  | 'cashmere'   // mauve
  | 'olive'      // avocado

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

export interface ContextDefinition {
  /** Prefijo de URL — la ruta debe empezar con esto para considerarse "dentro" del contexto. */
  path: string
  /** Clave del contexto que matchea con `availableContexts` del backend. */
  context: string
  /** Label visible en pickers, dropdowns, etc. */
  label: string
  /** Descripción opcional para el picker mobile. */
  description?: string
  /** Nombre del icono de @tabler/icons-vue (sin "Icon"). */
  icon?: string
  /** Ruta de login del contexto. */
  loginPath: string
  /** Ruta home (post-login). */
  home: string
  /** Política de uso en mobile. */
  mobile: {
    mode: ContextMobileMode
    /** Solo si mode === 'redirect' — adónde mandar desde mobile. */
    redirectTo?: string
  }
}
