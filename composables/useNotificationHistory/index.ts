import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { historyParams, type HistoryFilter } from './internal/format'

// Solo se exporta el composable: los helpers de ./internal/format no se
// auto-importan globalmente (evita choques de nombres en los productos).

/**
 * Historial de notificaciones del usuario (vista "ver todas"), sobre el
 * notification center de innertia-laravel (\Innertia\Notifications\Routes):
 *   GET    notifications   ?all=1&page=N&per_page=N → {data,total,unread,current_page,last_page,per_page}
 *   PATCH  notifications/{id}/read · PATCH notifications/read-all
 *   DELETE notifications/{id}      · DELETE notifications (borra las leídas)
 *
 * Usa la query key raíz ['notifications'] para que invalidar aquí refresque
 * también la campanita del producto (y viceversa) si comparte el QueryClient.
 * Nombre propio (no useNotifications) para no chocar con composables de producto.
 */
export function useNotificationHistory() {
  const api = useApi()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const list = (opts: MaybeRefOrGetter<{ filter: HistoryFilter; page: number; perPage: number }>) => useQuery({
    queryKey: computed(() => ['notifications', 'history', historyParams(toValue(opts))]),
    queryFn: () => api.get('notifications', { params: historyParams(toValue(opts)) }),
    placeholderData: (prev: any) => prev,
  })

  const markRead = () => useMutation({
    mutationFn: (id: string) => api.patch(`notifications/${id}/read`),
    onSuccess: invalidate,
  })

  const markAllRead = () => useMutation({
    mutationFn: () => api.patch('notifications/read-all'),
    onSuccess: invalidate,
  })

  const remove = () => useMutation({
    mutationFn: (id: string) => api.delete(`notifications/${id}`),
    onSuccess: invalidate,
  })

  const removeRead = () => useMutation({
    mutationFn: () => api.delete('notifications'),
    onSuccess: invalidate,
  })

  return { list, markRead, markAllRead, remove, removeRead, invalidate }
}
