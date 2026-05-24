# @innertia-solutions/innertia-nuxt

Capa Nuxt unificada de Innertia Solutions. Provee en un solo paquete:

- **Core** — composables base (useApi, useDate, useDevice, useDownload, useRealtime, etc.) + plugin pusher + SEO
- **App** — auth (JWT), contextos, permisos, vue-query, stores de notifications/auth, middlewares `auth`/`guest`
- **Saas** — multitenancy por subdomain (`X-Tenant` header, validación de tenant, store de tenant)
- **Spark** — design system: components, layouts, theme Tailwind, Preline, Tabler icons
- **Contexts** — apps multi-contexto (backoffice/teacher/technician...), mobile guard configurable

## Uso

```bash
pnpm add @innertia-solutions/innertia-nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['@innertia-solutions/innertia-nuxt'],
  css: ['@innertia-solutions/innertia-nuxt/spark.css'],

  appConfig: {
    innertia: {
      mode: 'saas', // 'saas' (default) | 'app'

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

    spark: { theme: 'default' },
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
