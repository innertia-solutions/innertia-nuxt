// Registra el interceptor del header X-Tenant.
// El backend (ResolveTenantFromHeader) identifica el tenant por su key/slug, no por UUID.
//   - saas: slug del tenant resuelto por subdominio (tenantStore); solo se envía
//     cuando el tenant está validado (tenantId != null) para evitar el 'local' de dev.
//   - open: key del tenant seleccionado in-app (activeTenant.activeKey).
// useRequestInterceptors auto-imported desde nuxt-core.
// useTenantStore / useActiveTenantStore auto-imported desde stores.
// Activo en mode === 'saas' | 'open'.
export default defineNuxtPlugin(() => {
  const { isOpen, hasTenant } = useInnertiaMode()

  // Modo sin tenant (app) → no inyectar header de tenant
  if (!hasTenant()) return

  const { add } = useRequestInterceptors()

  add((headers: Record<string, string>) => {
    // open: tenant por selección in-app
    if (isOpen()) {
      const activeTenant = useActiveTenantStore()
      if (activeTenant.activeKey) headers['X-Tenant'] = activeTenant.activeKey
      return
    }

    // saas: tenant por subdominio — solo si fue validado (tiene id) y tiene slug
    const tenantStore = useTenantStore()
    if (tenantStore.tenantId && tenantStore.tenantSlug) {
      headers['X-Tenant'] = tenantStore.tenantSlug
    }
  })
})
