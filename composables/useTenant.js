// useTenantStore auto-imported from saas stores
// useApi auto-imported from nuxt-app composables
import { computed } from 'vue'

export function useTenant() {
  const tenantStore = useTenantStore()
  const api = useApi()

  const currentTenant = computed(() => tenantStore.tenantId)
  const tenantSlug = computed(() => tenantStore.tenantSlug)

  /**
   * Recarga la config completa del tenant desde el backend.
   * El header X-Tenant-Id se inyecta automáticamente via el plugin api-tenant.
   * Llamar después del login en una app SaaS.
   */
  async function loadConfig() {
    const data = await api.get('tenant/config')
    tenantStore.setTenant(tenantStore.tenantId, data)
    return data
  }

  const isFeatureEnabled = (feature) => tenantStore.isFeatureEnabled(feature)
  const getOauthProviders = () => tenantStore.getOauthProviders()

  return { currentTenant, tenantSlug, loadConfig, isFeatureEnabled, getOauthProviders }
}
