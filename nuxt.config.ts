import tailwindcss from '@tailwindcss/vite'
import { collectBuildVersion } from './build/version'

// @innertia-solutions/innertia-nuxt — capa Nuxt unificada de Innertia Solutions.
// Provee: utilidades base + auth + multitenancy + design system + app contexts.
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/seo',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt', // requerido para persistir auth, dockedPreviews, etc.
    // Versiones: en build llena runtimeConfig.innertiaVersion (PRIVADO) con app/version/
    // commit/fecha del producto + versiones de nuxt/vue/innertia-nuxt de su node_modules.
    // Lo sirven /_version (público, sin deps) y /_version/details (vía backend platform).
    (_opts: unknown, nuxt: any) => {
      const current = nuxt.options.runtimeConfig.innertiaVersion ?? {}
      const built = collectBuildVersion(nuxt.options.rootDir)
      nuxt.options.runtimeConfig.innertiaVersion = {
        ...current,
        app: current.app || nuxt.options.runtimeConfig.public?.appName || built.app,
        version: current.version || built.version,
        commit: current.commit || built.commit,
        buildDate: current.buildDate || built.buildDate,
        packages: { ...built.packages, ...(current.packages ?? {}) },
      }
    },
  ],
  css: ['@innertia-solutions/innertia-nuxt/theme.css'],
  components: [
    { path: './components', pathPrefix: true, prefix: '' },
  ],
  imports: {
    dirs: ['stores', 'composables', 'composables/useWorkflow', 'composables/useStorageTestRunner', 'composables/useNotificationHistory', 'composables/usePasskeys', 'composables/useDriveBrowser', 'composables/useFileImports', 'composables/useFileVersions'],
    presets: [
      {
        from: '@tanstack/vue-query',
        imports: ['useQuery', 'useMutation', 'useQueryClient', 'useInfiniteQuery'],
      },
    ],
  },
  runtimeConfig: {
    // Privado (solo server). Llenado desde NUXT_SESSION_PASSWORD (≥32 chars).
    session: {
      password: '',
    },
    // Privado. Lo llena el módulo inline de arriba en build; override runtime con
    // NUXT_INNERTIA_VERSION_COMMIT / _BUILD_DATE / _VERSION / _DETAILS_PATH.
    innertiaVersion: {
      app: '',
      version: '',
      commit: '',
      buildDate: '',
      packages: {},
      detailsPath: 'platform/version',
    },
    // Privado. Renovación deslizante del JWT en el BFF (server/utils/sessionToken.ts):
    // renueva contra Laravel POST {path} cuando al token le quedan < 10 min (o < 1/3
    // de su vida). NUXT_AUTH_REFRESH_ENABLED=false la apaga; NUXT_AUTH_REFRESH_PATH
    // cambia el endpoint si el producto montó sessionRoutes con otro prefijo.
    authRefresh: {
      enabled: true,
      path: 'auth/refresh',
    },
    public: {
      loginPath: '/backoffice/login',
      homePath: '/backoffice',
    },
  },
  // Defaults de appConfig.innertia viven en app.config.ts del root
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['pusher-js'],
    },
  },
})
