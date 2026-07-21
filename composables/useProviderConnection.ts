/**
 * useProviderConnection — estado y flujo OAuth de un proveedor de archivos (ej. Google Drive).
 *
 * Consume los endpoints de conexión del backend innertia-laravel:
 *   - GET    files/providers/{provider}/status                 → { connected, email }
 *   - GET    files/providers/{provider}/connect?scope=user     → 302 al consent de Google (popup)
 *   - DELETE files/providers/{provider}/connection?scope=user  → { connected: false }
 *
 * El popup del consent se cierra solo (el callback devuelve <script>window.close()</script>);
 * al detectar el cierre invalidamos el status para reflejar la conexión.
 *
 * useApi / useQueryClient / useQuery / useRuntimeConfig se auto-importan en la capa.
 */
export function useProviderConnection(provider = 'google_drive') {
  const api = useApi()
  const queryClient = useQueryClient()

  const status = () => useQuery({
    queryKey: ['provider', provider, 'status'],
    queryFn: () => api.get(`files/providers/${provider}/status`),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['provider', provider, 'status'] })

  const connect = () => {
    if (typeof window === 'undefined') return
    const cfg  = useRuntimeConfig()
    const base = (cfg.public.apiBaseUrl || '/api').replace(/\/$/, '')
    const popup = window.open(`${base}/files/providers/${provider}/connect?scope=user`, 'provider-connect', 'width=520,height=680')
    // cuando el popup se cierra (callback hizo window.close), refrescamos el estado
    const timer = setInterval(() => {
      if (!popup || popup.closed) { clearInterval(timer); invalidate() }
    }, 800)
  }

  const disconnect = () => api.delete(`files/providers/${provider}/connection?scope=user`).then(invalidate)

  return { status, connect, disconnect, invalidate }
}
