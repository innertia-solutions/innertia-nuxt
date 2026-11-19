import { computed } from 'vue'
import type { PreferenceChange } from './internal/preferences'

/**
 * Preferencias de avisos del usuario (innertia-laravel \Innertia\Notifications\Routes::preferences()):
 *   GET me/notification-preferences → {data: NoticeTypePreference[]}
 *   PUT me/notification-preferences {preferences: [{type, channel, enabled}]}
 *
 * `base`: prefijo de la API (en /platform: 'platform/me/notification-preferences').
 */
export function useNotificationPreferences(options: { base?: string } = {}) {
  const base = String(options.base || 'me/notification-preferences').replace(/^\/+|\/+$/g, '')
  const api = useApi()
  const queryClient = useQueryClient()
  const queryKey = computed(() => ['notification-preferences', base])

  const query = useQuery({
    queryKey,
    queryFn: () => api.get(base),
  })

  const save = useMutation({
    mutationFn: (changes: PreferenceChange[]) => api.put(base, { preferences: changes }),
    onSuccess: (res: any) => queryClient.setQueryData(queryKey.value, res),
  })

  return { query, save }
}
