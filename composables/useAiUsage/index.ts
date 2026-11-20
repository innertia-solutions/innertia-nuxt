import { computed, type Ref } from 'vue'
import type { AiModelPrice, PriceField, UsageSummary } from './internal/aiUsage'

const clean = (base: string | undefined, fallback: string) => String(base || fallback).replace(/^\/+|\/+$/g, '')

/**
 * AI model prices (platform). innertia-laravel \Innertia\Ai\Routes::platform() + platformWrite():
 *   GET {base}/models/prices · PUT {base}/models/{id}/prices
 */
export function useAiModelPrices(options: { base?: string } = {}) {
  const base = clean(options.base, 'platform/ai')
  const api = useApi()
  const queryClient = useQueryClient()
  const key = computed(() => ['ai', base, 'model-prices'])

  const list = useQuery({
    queryKey: key,
    queryFn: () => api.get(`${base}/models/prices`),
    select: (res: any) => (res?.data ?? []) as AiModelPrice[],
  })

  const update = useMutation({
    mutationFn: ({ id, prices }: { id: string; prices: Record<PriceField, number | null> }) =>
      api.put(`${base}/models/${id}/prices`, prices),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.value }),
  })

  return { list, update }
}

/**
 * Aggregated AI usage of a month.
 *   scope 'platform'  → GET {base}/usage/report?month=&tenant_id= (with by_tenant)
 *   scope 'tenant'    → GET {base}/usage/summary?month= (active space)
 */
export function useAiUsage(month: Ref<string>, options: { base?: string; scope?: 'platform' | 'tenant'; tenantId?: Ref<string | null> } = {}) {
  const scope = options.scope ?? 'platform'
  const base = clean(options.base, scope === 'platform' ? 'platform/ai' : 'ai')
  const api = useApi()
  const path = scope === 'platform' ? 'usage/report' : 'usage/summary'

  return useQuery({
    queryKey: computed(() => ['ai', base, path, month.value, options.tenantId?.value ?? null]),
    queryFn: () => api.get(`${base}/${path}`, {
      params: { month: month.value, ...(options.tenantId?.value ? { tenant_id: options.tenantId.value } : {}) },
    }) as Promise<UsageSummary>,
  })
}
