// useAppStore + useInnertiaMode auto-importados.
// Server-only: en app mode hace fetch de /status (branding + features + demo) y
// puebla useAppStore. Equivalente app-mode de 02.validate-tenant (saas).
// Solo activo en mode === 'app'.
export default defineNuxtRouteMiddleware(async () => {
  if (!useInnertiaMode().isApp()) return
  if (!import.meta.server) return

  const appStore = useAppStore()
  if (appStore.branding?.name) return // ya poblado este request

  const config = useRuntimeConfig()
  const internalUrl = (config as any).apiInternalUrl || 'http://api:80'

  try {
    const data = await $fetch<{
      ok: boolean
      branding?: { name?: string; demo?: { email: string; password: string } | null }
      features?: Record<string, any>
    }>(`${internalUrl}/status`, {
      headers: { Accept: 'application/json' },
      timeout: 5000,
    })
    appStore.setStatus(data)
  } catch (e: any) {
    // No romper la navegación: el login debe funcionar aunque no haya demo.
    console.warn('[app-status] /status no disponible:', e?.message)
  }
})
