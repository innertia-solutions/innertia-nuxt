import { computed } from 'vue'
import type { ApiKey, ApiScope, Webhook, WebhookEvent, WebhookLog } from './internal/integrations'

// Only the composables are exported: ./internal helpers are not auto-imported globally
// (avoids name clashes in products).

const clean = (base?: string) => String(base || 'integrations').replace(/^\/+|\/+$/g, '')

export interface CursorPage<T> { data: T[]; meta?: { next_cursor?: string | null; limit?: number } }

/**
 * API keys of the active space (innertia-laravel \Innertia\PublicApi\Routes::manage()):
 *   GET api-keys · GET api-keys/scopes · POST api-keys → {data, secret} (shown once)
 *   POST api-keys/{id}/rotate → {data, secret, previous} · DELETE api-keys/{id}
 *   GET api-keys/{id}/requests?cursor&limit → {data, meta.next_cursor}
 *
 * `base`: API prefix where the product mounted the routes (default 'integrations').
 */
export function useApiKeys(options: { base?: string } = {}) {
  const base = clean(options.base)
  const api = useApi()
  const queryClient = useQueryClient()
  const listKey = computed(() => ['integrations', base, 'api-keys'])
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey.value })

  const list = useQuery({
    queryKey: listKey,
    queryFn: () => api.get(`${base}/api-keys`),
    select: (res: any) => (res?.data ?? []) as ApiKey[],
  })

  const scopes = useQuery({
    queryKey: computed(() => ['integrations', base, 'api-key-scopes']),
    queryFn: () => api.get(`${base}/api-keys/scopes`),
    select: (res: any) => (res?.data ?? []) as ApiScope[],
    staleTime: 5 * 60_000,
  })

  const create = useMutation({
    mutationFn: (body: { name: string; scopes: string[]; organization_id?: string | number | null; expires_at?: string | null }) =>
      api.post(`${base}/api-keys`, body) as Promise<{ data: ApiKey; secret: string }>,
    onSuccess: invalidate,
  })

  const rotate = useMutation({
    mutationFn: (id: string) =>
      api.post(`${base}/api-keys/${id}/rotate`, {}) as Promise<{ data: ApiKey; secret: string; previous?: { id: string; expires_at: string | null } }>,
    onSuccess: invalidate,
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`${base}/api-keys/${id}`) as Promise<{ data: ApiKey }>,
    onSuccess: invalidate,
  })

  /** Request log page of a key (cursor pagination). */
  function requests(id: string, cursor?: string | null, limit = 25): Promise<CursorPage<any>> {
    return api.get(`${base}/api-keys/${id}/requests`, { params: { limit, ...(cursor ? { cursor } : {}) } })
  }

  return { list, scopes, create, rotate, revoke, requests }
}

/**
 * Outbound webhooks of the active space (innertia-laravel \Innertia\PublicApi\Routes::manage()):
 *   GET webhooks · GET webhooks/events · POST webhooks → {data, secret} · GET|PATCH|DELETE webhooks/{id}
 *   POST webhooks/{id}/rotate-secret → {data, secret} · POST webhooks/{id}/test
 *   GET webhooks/{id}/logs?cursor&limit&status · GET webhooks/{id}/logs/{log} · POST …/logs/{log}/resend
 */
export function useWebhooks(options: { base?: string } = {}) {
  const base = clean(options.base)
  const api = useApi()
  const queryClient = useQueryClient()
  const listKey = computed(() => ['integrations', base, 'webhooks'])
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey.value })

  const list = useQuery({
    queryKey: listKey,
    queryFn: () => api.get(`${base}/webhooks`),
    select: (res: any) => (res?.data ?? []) as Webhook[],
  })

  const events = useQuery({
    queryKey: computed(() => ['integrations', base, 'webhook-events']),
    queryFn: () => api.get(`${base}/webhooks/events`),
    select: (res: any) => (res?.data ?? []) as WebhookEvent[],
    staleTime: 5 * 60_000,
  })

  type WebhookInput = { url?: string; events?: string[]; description?: string | null; organization_id?: string | number | null; scopes?: string[]; active?: boolean }

  const create = useMutation({
    mutationFn: (body: WebhookInput) => api.post(`${base}/webhooks`, body) as Promise<{ data: Webhook; secret: string }>,
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, ...body }: WebhookInput & { id: string | number }) =>
      api.patch(`${base}/webhooks/${id}`, body) as Promise<{ data: Webhook }>,
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string | number) => api.delete(`${base}/webhooks/${id}`),
    onSuccess: invalidate,
  })

  const rotateSecret = useMutation({
    mutationFn: (id: string | number) => api.post(`${base}/webhooks/${id}/rotate-secret`, {}) as Promise<{ data: Webhook; secret: string }>,
    onSuccess: invalidate,
  })

  const test = useMutation({
    mutationFn: (id: string | number) => api.post(`${base}/webhooks/${id}/test`, {}) as Promise<{ data: WebhookLog }>,
  })

  const resend = useMutation({
    mutationFn: ({ id, logId }: { id: string | number; logId: string | number }) =>
      api.post(`${base}/webhooks/${id}/logs/${logId}/resend`, {}) as Promise<{ data: WebhookLog }>,
  })

  /** Delivery log page (cursor pagination, optional status filter). */
  function logs(id: string | number, params: { cursor?: string | null; status?: string; limit?: number } = {}): Promise<CursorPage<WebhookLog>> {
    const q: Record<string, any> = { limit: params.limit ?? 25 }
    if (params.cursor) q.cursor = params.cursor
    if (params.status) q.status = params.status
    return api.get(`${base}/webhooks/${id}/logs`, { params: q })
  }

  /** One delivery with payload, request headers and (truncated) response body. */
  function log(id: string | number, logId: string | number): Promise<{ data: WebhookLog }> {
    return api.get(`${base}/webhooks/${id}/logs/${logId}`)
  }

  return { list, events, create, update, remove, rotateSecret, test, resend, logs, log }
}
