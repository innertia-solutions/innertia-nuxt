# @innertia-solutions/innertia-nuxt

Capa Nuxt unificada de Innertia Solutions. Provee en un solo paquete:

- **Utilities** — composables base (useApi, useDate, useDevice, useDownload, useRealtime, etc.) + plugin pusher + SEO
- **Auth** — JWT, contextos, permisos, vue-query, stores de notifications/auth, middlewares `auth`/`guest`
- **Multitenancy** — multi-tenant por subdomain (`X-Tenant` header, validación de tenant, store de tenant)
- **Design system** — components, layouts, theme Tailwind, Preline, Tabler icons, tema configurable
- **App contexts** — apps multi-contexto (backoffice/teacher/technician...), mobile guard configurable

## Uso

```bash
pnpm add @innertia-solutions/innertia-nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['@innertia-solutions/innertia-nuxt'],
  css: ['@innertia-solutions/innertia-nuxt/theme.css'],

  appConfig: {
    innertia: {
      mode: 'saas', // 'saas' (default) | 'app'

      branding: { name: 'MyApp', version: '1.0.0' },

      // Tema Preline — define el "feel" completo (paleta neutral, dark mode tone).
      // Ver https://preline.co/docs/themes.html
      theme: 'moon',  // 'default' | 'harvest' | 'retro' | 'ocean' | 'autumn' | 'moon' | 'bubblegum' | 'cashmere' | 'olive'

      // Override del brand color del tema (opcional)
      colors: { primary: 'violet', secondary: 'slate' },

      apps: {
        backoffice: {
          path: '/backoffice',
          context: 'backoffice',
          label: 'Backoffice',
          icon: 'IconBuildingSkyscraper',
          loginPath: '/backoffice/login',
          home: '/backoffice',
          mobile: { mode: 'block' },
        },
        // ...más contextos
      },

      mobile: { breakpoint: 1024, rememberChoice: true },
    },
  },
})
```

## Modos

| Modo | Subdomain detection | Tenant validation | X-Tenant header | Auth | Apps |
|---|---|---|---|---|---|
| `saas` (default) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `app` | ❌ | ❌ | ❌ | ✅ | ✅ |

## CI

- **Push a `main`** → `auto-publish.yml` bumpea patch y publica automáticamente.
- **Workflow `release.yml` manual** → permite elegir bump (patch/minor/major).

Requiere `NPM_TOKEN` configurado en environment `NPM` del repo.
