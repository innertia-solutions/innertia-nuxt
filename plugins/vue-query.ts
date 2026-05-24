import type { DehydratedState } from '@tanstack/vue-query'
import { VueQueryPlugin, QueryClient, dehydrate, hydrate } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
  const vueQueryState = useState<DehydratedState | null>('vue-query')

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,   // 5 min — datos frescos sin re-fetch
        gcTime: 10 * 60 * 1000,     // 10 min — cache se limpia si no hay subscribers
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })

  if (import.meta.server) {
    nuxtApp.hooks.hook('app:rendered', () => {
      vueQueryState.value = dehydrate(queryClient)
    })
  }

  if (import.meta.client) {
    hydrate(queryClient, vueQueryState.value)
  }
})
