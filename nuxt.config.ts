import tailwindcss from '@tailwindcss/vite'

// @innertia-solutions/innertia-nuxt — capa Nuxt unificada de Innertia Solutions.
// Provee: utilidades base + auth + multitenancy + design system + app contexts.
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/seo',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt', // requerido para persistir auth, dockedPreviews, etc.
  ],
  css: ['@innertia-solutions/innertia-nuxt/theme.css'],
  components: [
    { path: './components', pathPrefix: true, prefix: '' },
  ],
  imports: {
    dirs: ['stores', 'composables', 'composables/useWorkflow'],
    presets: [
      {
        from: '@tanstack/vue-query',
        imports: ['useQuery', 'useMutation', 'useQueryClient', 'useInfiniteQuery'],
      },
    ],
  },
  runtimeConfig: {
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
