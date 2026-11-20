import { computed, type Ref } from 'vue'
import type { Invoice, MeterDefinition, Plan } from './internal/billing'

const clean = (base: string | undefined, fallback: string) => String(base || fallback).replace(/^\/+|\/+$/g, '')

/** Opens a PDF endpoint as a download (blob with auth headers). */
export function useBillingPdf() {
  const { download } = useDownload()
  return async (path: string, filename: string) => {
    const { blob } = await download(path)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/**
 * Platform billing (innertia-laravel \Innertia\Billing\Routes::platform() + platformWrite()).
 * `base`: prefix where the product mounted them (default 'platform/billing').
 */
export function useBillingPlatform(options: { base?: string } = {}) {
  const base = clean(options.base, 'platform/billing')
  const api = useApi()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['billing', base] })

  const plans = useQuery({
    queryKey: ['billing', base, 'plans'],
    queryFn: () => api.get(`${base}/plans`),
    select: (res: any) => (res?.data ?? []) as Plan[],
  })

  const meters = useQuery({
    queryKey: ['billing', base, 'meters'],
    queryFn: () => api.get(`${base}/meters`),
    select: (res: any) => (res?.data ?? []) as MeterDefinition[],
    staleTime: 5 * 60_000,
  })

  const savePlan = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, any> }) =>
      id ? api.patch(`${base}/plans/${id}`, body) : api.post(`${base}/plans`, body),
    onSuccess: invalidate,
  })

  function invoices(filters: Ref<Record<string, any>>) {
    return useQuery({
      queryKey: computed(() => ['billing', base, 'invoices', { ...filters.value }]),
      queryFn: () => api.get(`${base}/invoices`, { params: Object.fromEntries(Object.entries(filters.value).filter(([, v]) => v !== '' && v !== null && v !== undefined)) }),
    })
  }

  const invoice = (id: string) => api.get(`${base}/invoices/${id}`) as Promise<Invoice>

  const issue = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { folio?: string | null; pdf_file_id?: string | null; send?: boolean } }) =>
      api.post(`${base}/invoices/${id}/issue`, body) as Promise<Invoice>,
    onSuccess: invalidate,
  })

  const resend = useMutation({
    mutationFn: (id: string) => api.post(`${base}/invoices/${id}/resend`, {}) as Promise<{ sent: boolean }>,
  })

  const registerPayment = useMutation({
    mutationFn: (body: { client_id: string; amount: number; method?: string; reference?: string | null; received_at?: string | null; invoice_id?: string | null }) =>
      api.post(`${base}/payments`, body),
    onSuccess: invalidate,
  })

  function space(key: Ref<string>) {
    return useQuery({
      queryKey: computed(() => ['billing', base, 'space', key.value]),
      queryFn: () => api.get(`${base}/spaces/${encodeURIComponent(key.value)}`),
      enabled: computed(() => !!key.value),
    })
  }

  const startSubscription = useMutation({
    mutationFn: ({ key, body }: { key: string; body: Record<string, any> }) => api.post(`${base}/spaces/${encodeURIComponent(key)}/subscription`, body),
    onSuccess: invalidate,
  })

  const updateSubscription = useMutation({
    mutationFn: ({ key, body }: { key: string; body: Record<string, any> }) => api.patch(`${base}/spaces/${encodeURIComponent(key)}/subscription`, body),
    onSuccess: invalidate,
  })

  const subscriptionAction = useMutation({
    mutationFn: ({ key, action }: { key: string; action: 'suspend' | 'reactivate' | 'cancel' }) =>
      api.post(`${base}/spaces/${encodeURIComponent(key)}/subscription/${action}`, {}),
    onSuccess: invalidate,
  })

  const clientTotals = useQuery({
    queryKey: ['billing', base, 'clients-totals'],
    queryFn: () => api.get(`${base}/clients/totals`),
  })

  const settings = useQuery({
    queryKey: ['billing', base, 'settings'],
    queryFn: () => api.get(`${base}/settings`),
  })

  const saveSettings = useMutation({
    mutationFn: (body: Record<string, any>) => api.put(`${base}/settings`, body),
    onSuccess: invalidate,
  })

  const run = useMutation({
    mutationFn: (job: 'close' | 'dunning') => api.post(`${base}/run/${job}`, {}),
    onSuccess: invalidate,
  })

  return {
    base, plans, meters, savePlan, invoices, invoice, issue, resend, registerPayment, space,
    startSubscription, updateSubscription, subscriptionAction, clientTotals, settings, saveSettings, run,
  }
}

/**
 * Backoffice billing of the active space, read-only (innertia-laravel \Innertia\Billing\Routes::backoffice()).
 * `base`: default 'billing'.
 */
export function useBillingSpace(options: { base?: string } = {}) {
  const base = clean(options.base, 'billing')
  const api = useApi()

  const overview = useQuery({ queryKey: ['billing-space', base, 'overview'], queryFn: () => api.get(`${base}/overview`) })
  const invoices = useQuery({
    queryKey: ['billing-space', base, 'invoices'],
    queryFn: () => api.get(`${base}/invoices`),
    select: (res: any) => (res?.data ?? []) as Invoice[],
  })
  const payments = useQuery({
    queryKey: ['billing-space', base, 'payments'],
    queryFn: () => api.get(`${base}/payments`),
    select: (res: any) => (res?.data ?? []) as any[],
  })

  return { base, overview, invoices, payments }
}
