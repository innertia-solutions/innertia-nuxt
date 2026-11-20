import { computed, type Ref } from 'vue'
import type { Adjustment, BankTransaction, Invoice, MeterDefinition, Plan } from './internal/billing'

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

const compact = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined))

/** Downloads a file endpoint (xlsx exports) with the session, optional query params. */
export function useBillingDownload() {
  const { download } = useDownload()
  return async (path: string, filename: string, params: Record<string, any> = {}) => {
    const { blob } = await download(path, compact(params))
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
    mutationFn: (job: 'close' | 'dunning' | 'reminders') => api.post(`${base}/run/${job}`, {}),
    onSuccess: invalidate,
  })

  // ── Collections (stage 3) ────────────────────────────────────────────────
  const post = (path: string, body: Record<string, any> = {}) => api.post(`${base}/${path}`, body)
  const mutation = <T = any>(fn: (vars: any) => Promise<T>) => useMutation({ mutationFn: fn, onSuccess: invalidate })

  function adjustments(filters: Ref<Record<string, any>>) {
    return useQuery({
      queryKey: computed(() => ['billing', base, 'adjustments', { ...filters.value }]),
      queryFn: () => api.get(`${base}/adjustments`, { params: compact(filters.value) }),
      select: (res: any) => (res?.data ?? []) as Adjustment[],
    })
  }
  const createAdjustment = mutation((body: Record<string, any>) => post('adjustments', body))
  const cancelAdjustment = mutation(({ id, reason }: { id: string; reason: string }) => post(`adjustments/${id}/cancel`, { reason }))
  const createCreditNote = mutation((body: Record<string, any>) => post('credit-notes', body) as Promise<Adjustment>)

  function terms(clientId: Ref<string>) {
    return useQuery({
      queryKey: computed(() => ['billing', base, 'terms', clientId.value]),
      queryFn: () => api.get(`${base}/clients/${clientId.value}/terms`),
      enabled: computed(() => !!clientId.value),
    })
  }
  const saveTerms = mutation(({ clientId, body }: { clientId: string; body: Record<string, any> }) => api.put(`${base}/clients/${clientId}/terms`, body))
  const applyCredit = mutation(({ clientId, invoiceId }: { clientId: string; invoiceId?: string | null }) =>
    post(`clients/${clientId}/apply-credit`, { invoice_id: invoiceId ?? null }) as Promise<{ applied: number; credit_available: number }>)

  function account(clientId: Ref<string>, params: Ref<Record<string, any>>) {
    return useQuery({
      queryKey: computed(() => ['billing', base, 'account', clientId.value, { ...params.value }]),
      queryFn: () => api.get(`${base}/clients/${clientId.value}/account`, { params: compact(params.value) }),
      enabled: computed(() => !!clientId.value),
    })
  }

  function activity(filters: Ref<Record<string, any>>) {
    return useQuery({
      queryKey: computed(() => ['billing', base, 'activity', { ...filters.value }]),
      queryFn: () => api.get(`${base}/activity`, { params: compact(filters.value) }),
    })
  }

  const voidInvoice = mutation(({ id, reason }: { id: string; reason: string }) => post(`invoices/${id}/void`, { reason }) as Promise<Invoice>)
  const reissue = mutation(({ id, body }: { id: string; body: Record<string, any> }) => post(`invoices/${id}/reissue`, body) as Promise<Invoice>)
  const waiveLateFees = mutation(({ id, reason }: { id: string; reason: string }) =>
    post(`invoices/${id}/waive-late-fees`, { reason }) as Promise<{ removed: number; credited: number }>)

  // Reconciliation
  const { upload } = useFile()
  const preview = (file: File, headerRow?: number | null) =>
    upload(`${base}/reconciliation/preview`, file, { extraData: { header_row: headerRow ?? null } }) as Promise<any>
  const importStatement = mutation(({ file, mapping, bank, headerRow }: { file: File; mapping: Record<string, string>; bank?: string | null; headerRow?: number | null }) =>
    upload(`${base}/reconciliation/imports`, file, { extraData: { mapping: compact(mapping), bank: bank || null, header_row: headerRow ?? null } }) as Promise<any>)
  const imports = useQuery({
    queryKey: ['billing', base, 'bank-imports'],
    queryFn: () => api.get(`${base}/reconciliation/imports`),
    select: (res: any) => (res?.data ?? []) as any[],
    // Poll while an import is queued or running.
    refetchInterval: (query: any) => ((query.state.data?.data ?? []) as any[]).some(i => i.status === 'pending' || i.status === 'processing') ? 3000 : false,
  })
  function transactions(filters: Ref<Record<string, any>>) {
    return useQuery({
      queryKey: computed(() => ['billing', base, 'bank-transactions', { ...filters.value }]),
      queryFn: () => api.get(`${base}/reconciliation/transactions`, { params: compact(filters.value) }),
    })
  }
  const openInvoices = (params: { client_id?: string | null; q?: string | null }) =>
    api.get(`${base}/reconciliation/open-invoices`, { params: compact(params) }).then((res: any) => (res?.data ?? []) as Invoice[])
  const match = mutation(({ id, clientId, invoiceIds }: { id: string; clientId: string; invoiceIds: string[] }) =>
    post(`reconciliation/transactions/${id}/match`, { client_id: clientId, invoice_ids: invoiceIds }) as Promise<BankTransaction>)
  const unmatch = mutation(({ id, reason }: { id: string; reason: string }) => post(`reconciliation/transactions/${id}/unmatch`, { reason }))
  const ignore = mutation(({ id, reason }: { id: string; reason?: string | null }) => post(`reconciliation/transactions/${id}/ignore`, { reason: reason ?? null }))
  const restore = mutation((id: string) => post(`reconciliation/transactions/${id}/restore`))
  const rematch = mutation((importId?: string | null) => post('reconciliation/rematch', { import_id: importId ?? null }) as Promise<{ matched: number; suggested: number; unmatched: number }>)

  function report(name: Ref<string>, params: Ref<Record<string, any>>) {
    return useQuery({
      queryKey: computed(() => ['billing', base, 'report', name.value, { ...params.value }]),
      queryFn: () => api.get(`${base}/reports/${name.value}`, { params: compact(params.value) }),
      enabled: computed(() => !!name.value),
    })
  }

  return {
    base, plans, meters, savePlan, invoices, invoice, issue, resend, registerPayment, space,
    startSubscription, updateSubscription, subscriptionAction, clientTotals, settings, saveSettings, run,
    adjustments, createAdjustment, cancelAdjustment, createCreditNote, terms, saveTerms, applyCredit, account, activity,
    voidInvoice, reissue, waiveLateFees, preview, importStatement, imports, transactions, openInvoices, match, unmatch,
    ignore, restore, rematch, report,
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

  function account(params: Ref<Record<string, any>>) {
    return useQuery({
      queryKey: computed(() => ['billing-space', base, 'account', { ...params.value }]),
      queryFn: () => api.get(`${base}/account`, { params: compact(params.value) }),
    })
  }

  return { base, overview, invoices, payments, account }
}
