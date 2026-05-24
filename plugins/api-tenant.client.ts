// Registra el interceptor del header X-Tenant.
// El backend (ResolveTenantFromHeader) identifica el tenant por su key/slug,
// no por UUID. Solo se envía cuando el tenant está validado (tenantId != null)
// para evitar enviar el slug 'local' de dev que no existe en la DB.
// useRequestInterceptors auto-imported desde nuxt-core.
// useTenantStore auto-imported desde saas stores.
// Solo activo en mode === 'saas'.
export default defineNuxtPlugin(() => {
  // Modo no-saas → no inyectar header de tenant
  if (!useInnertiaMode().hasTenant()) return

  const { add } = useRequestInterceptors()
  const tenantStore = useTenantStore()

  add((headers: Record<string, string>) => {
    // Solo enviar si el tenant fue validado (tiene id) y tiene slug
    if (tenantStore.tenantId && tenantStore.tenantSlug) {
      headers['X-Tenant'] = tenantStore.tenantSlug
    }
  })
})
