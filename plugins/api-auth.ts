// Registers the Authorization header interceptor into the shared registry.
// Universal: useCookie reads request cookies in SSR and document.cookie on client.
export default defineNuxtPlugin(() => {
  const { add } = useRequestInterceptors()

  add((headers: Record<string, string>, options: Record<string, unknown>) => {
    if (options.useToken !== false) {
      const token = useAuthStore().getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
    }
  })
})
