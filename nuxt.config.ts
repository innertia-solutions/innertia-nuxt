import tailwindcss from '@tailwindcss/vite'

// @innertia-solutions/innertia-nuxt — capa base unificada.
// Provee: core (utilities, pusher, seo) + app (auth, context, vue-query)
//       + saas (multitenancy) + spark (tema visual, components, layouts)
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/seo',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt', // requerido para persistir auth, dockedPreviews, etc.
  ],
  css: ['@innertia-solutions/innertia-nuxt/spark.css'],
  components: [
    { path: './components', pathPrefix: true, prefix: '' },
  ],
  imports: {
    dirs: ['stores', 'composables'],
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
  appConfig: {
    spark: {
      theme: 'default', // default | harvest | retro | ocean | autumn | moon | bubblegum | olive | cashmere
    },
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['pusher-js'],
    },
  },
})
