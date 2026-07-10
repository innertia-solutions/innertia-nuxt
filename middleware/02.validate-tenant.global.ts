// useTenantStore auto-imported.
// Server-only: valida el tenant via GET /status con X-Tenant header.
// Usa la URL interna del backend (apiInternalUrl) para evitar pasar por el proxy de Nitro.
// Solo activo en mode === 'saas'.
export default defineNuxtRouteMiddleware(async (to) => {
  // Solo saas valida el tenant por subdominio (open lo hace por selección in-app)
  if (!useInnertiaMode().isSaas()) return

  if (!import.meta.server) return

  // Rutas públicas que no requieren tenant válido
  const publicRoutes = ['/tenant-error', '/404']
  const isPublic =
    publicRoutes.some(r => to.path.startsWith(r)) ||
    to.path.startsWith('/auth/')

  if (isPublic) return

  // Skip en contexto admin
  if (useState('isAdminContext', () => false).value) return

  const tenantSlug = useState<string>('tenantSlug', () => '').value

  console.log(`[tenant:validate] path=${to.path} slug="${tenantSlug}"`)

  if (!tenantSlug) {
    console.warn('[tenant:validate] sin slug → /tenant-error?reason=no-subdomain')
    return navigateTo('/tenant-error?reason=no-subdomain')
  }

  // URL interna del backend (no pasa por el proxy Nitro — no existe en SSR)
  const config = useRuntimeConfig()
  const internalUrl = (config as any).apiInternalUrl || 'http://api:80'
  const statusUrl = `${internalUrl}/status`

  console.log(`[tenant:validate] status → ${statusUrl} (X-Tenant: ${tenantSlug})`)

  try {
    // Shape esperado:
    // { ok, tenant: { id, key, name, status, isActive },
    //   features: { organizations, teams, twoFactor, oauth: [] },
    //   branding: { demo } }
    const data = await $fetch<{
      ok: boolean
      tenant: { id: number; key: string; name: string; status: string; isActive: boolean }
      features?: Record<string, any>
      branding?: Record<string, any>
    }>(
      statusUrl,
      {
        headers: { 'X-Tenant': tenantSlug, 'Accept': 'application/json' },
        timeout: 5000,
      }
    )

    console.log(`[tenant:validate] respuesta:`, JSON.stringify(data))

    if (!data?.ok) {
      console.warn('[tenant:validate] tenant inactivo → /tenant-error?reason=inactive')
      return navigateTo('/tenant-error?reason=inactive')
    }

    // tenantStore.setTenant expects (id, config). Combinamos features + branding como config
    // para compatibilidad con consumidores existentes que leen tenantStore.config.
    const tenantStore = useTenantStore()
    tenantStore.setTenant(data.tenant.id, {
      ...(data.tenant ?? {}),
      features: data.features ?? {},
      branding: data.branding ?? {},
      // Compatibilidad con código viejo que lee config.demo y config.oauthProviders directo
      demo: data.branding?.demo ?? null,
      oauthProviders: data.features?.oauth ?? [],
    })
    console.log(`[tenant:validate] OK — tenant id=${data.tenant.id} status=${data.tenant.status}`)
  } catch (e: any) {
    const status = e?.response?.status
    if (status === 404) {
      console.warn(`[tenant:validate] 404 tenant no encontrado → inactive`)
      return navigateTo('/tenant-error?reason=inactive')
    }
    const reason = e?.message?.includes('timeout') ? 'timeout' : 'unreachable'
    console.error(`[tenant:validate] error → ${reason}`, e?.message)
    return navigateTo(`/tenant-error?reason=${reason}`)
  }
})
