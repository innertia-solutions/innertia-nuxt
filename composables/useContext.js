// useAuthStore, useApi, useAuth auto-imported
import { computed } from 'vue'

export function useContext() {
  const authStore = useAuthStore()
  const api = useApi()
  const { fetchMe } = useAuth()

  const currentContext = computed(() => authStore.currentContext)
  const availableContexts = computed(() => authStore.availableContexts)

  /**
   * Check whether user has permission to switch to targetContext.
   * Returns:
   *   { success: false, reason: 'no_permission' }  — user cannot switch
   *   { success: true, requiresConfirmation: true } — show confirmation UI
   */
  async function switchContext(targetContext) {
    const data = await api.get(`auth/context/${targetContext}/check`)
    if (!data.hasAccess) {
      return { success: false, reason: 'no_permission' }
    }
    return { success: true, requiresConfirmation: true }
  }

  /**
   * Execute the context switch after user confirmation.
   * Updates store and reloads permissions via fetchMe.
   */
  async function confirmSwitch(targetContext) {
    authStore.setCurrentContext(targetContext)
    await fetchMe()
    return { success: true }
  }

  /**
   * Quick synchronous check — is this context in the available list?
   */
  function hasAccessToContext(context) {
    return authStore.availableContexts.includes(context)
  }

  return { currentContext, availableContexts, switchContext, confirmSwitch, hasAccessToContext }
}
