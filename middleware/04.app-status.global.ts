// useAppStore + useInnertiaMode auto-importados.
// En app mode hace fetch de /status (branding + features + demo) y puebla
// useAppStore. Equivalente app-mode de 02.validate-tenant (saas).
// Corre en server (SSR) o en client (páginas con ssr:false, p.ej. routeRules
// '/backoffice/**': { ssr: false }) — donde el server nunca pobló el store.
export default defineNuxtRouteMiddleware(async () => {
  if (!useInnertiaMode().isApp()) return

  const appStore = useAppStore()
  if (appStore.branding?.name) return // ya poblado

  const config = useRuntimeConfig()
  // Misma resolución dual que useApi: server → red interna; client → proxy público.
  const base = import.meta.server
    ? ((config as any).apiInternalUrl || 'http://api:80')
    : ((config.public as any).apiBaseUrl || '/api')

  try {
    const data = await $fetch<{
      ok: boolean
      branding?: { name?: string; demo?: { email: string; password: string } | null }
      features?: Record<string, any>
    }>(`${base}/status`, {
      headers: { Accept: 'application/json' },
      timeout: 5000,
    })
    appStore.setStatus(data)
  } catch (e: any) {
    // No romper la navegación: el login debe funcionar aunque no haya demo.
    console.warn('[app-status] /status no disponible:', e?.message)
  }
})
