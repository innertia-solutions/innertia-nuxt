<script setup lang="ts">
import { formatMoney, subscriptionStatus } from '../../composables/useBilling/internal/billing'

/*
 * Billing.ClientTotals — per client: MRR (monthly base of billable subscriptions), open balance,
 * overdue and drafts, with its spaces (Prod/Pruebas badge, subscription status, plan).
 * Backend: GET {endpoint}/clients/totals. Emits `select-client` / `select-space` for navigation.
 *
 *   <Billing.ClientTotals @select-space="key => navigateTo(`/platform/spaces/${key}`)" />
 */
const props = withDefaults(defineProps<{ endpoint?: string }>(), { endpoint: 'platform/billing' })
const emit = defineEmits<{ 'select-client': [id: string]; 'select-space': [key: string] }>()

const { clientTotals } = useBillingPlatform({ base: props.endpoint })
const data = computed<any>(() => clientTotals.data.value)
const filter = ref<'all' | 'balance' | 'overdue'>('all')
const rows = computed<any[]>(() => (data.value?.data ?? []).filter((c: any) =>
  filter.value === 'all' ? true : filter.value === 'overdue' ? c.overdue > 0 : c.balance > 0))
</script>

<template>
  <div class="space-y-4">
    <div v-if="data" class="grid gap-3 sm:grid-cols-3">
      <App.StatCard label="MRR" :value="formatMoney(data.totals.mrr)" hint="Base mensual de las suscripciones vigentes" />
      <App.StatCard label="Por cobrar" :value="formatMoney(data.totals.balance)" />
      <App.StatCard label="Vencido" :value="formatMoney(data.totals.overdue)" :value-class="data.totals.overdue > 0 ? 'text-danger' : 'text-foreground'" />
    </div>

    <div class="flex gap-2 text-sm">
      <button v-for="f in [['all', 'Todos'], ['balance', 'Con saldo'], ['overdue', 'Con mora']]" :key="f[0]" type="button"
        class="px-3 py-1 rounded-control border" :class="filter === f[0] ? 'border-primary text-primary' : 'border-card-line text-muted-foreground'"
        @click="filter = f[0] as any">{{ f[1] }}</button>
    </div>

    <div class="bg-card border border-card-line rounded-card overflow-hidden">
      <div v-if="clientTotals.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="clientTotals.isError.value" class="p-8 text-center text-sm text-muted-foreground">
        No se pudieron cargar los totales.
        <button type="button" class="text-primary hover:underline" @click="clientTotals.refetch()">Reintentar</button>
      </div>
      <div v-else-if="!rows.length" class="p-8 text-center text-sm text-muted-foreground">Sin clientes para este filtro.</div>
      <ul v-else class="divide-y divide-card-line">
        <li v-for="c in rows" :key="c.client_id" class="px-5 py-3 space-y-2">
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" class="flex-1 text-left font-medium text-foreground hover:underline" @click="emit('select-client', c.client_id)">
              {{ c.name }} <span class="text-xs font-normal text-muted-foreground">{{ c.invoicing_mode === 'per_space' ? 'Factura por espacio' : 'Factura consolidada' }}</span>
            </button>
            <span class="text-muted-foreground">MRR {{ formatMoney(c.mrr) }}</span>
            <span>Saldo {{ formatMoney(c.balance) }}</span>
            <span :class="c.overdue > 0 ? 'text-danger font-medium' : 'text-muted-foreground'">Vencido {{ formatMoney(c.overdue) }}</span>
            <App.Tag v-if="c.drafts" :text="`${c.drafts} borrador${c.drafts > 1 ? 'es' : ''}`" severity="info" size="xs" />
          </div>
          <div class="flex flex-wrap gap-2">
            <button v-for="s in c.spaces" :key="s.key" type="button" class="flex items-center gap-1.5 rounded-control border border-card-line px-2 py-1 text-xs hover:bg-muted/50" @click="emit('select-space', s.key)">
              <span class="text-foreground">{{ s.name }}</span>
              <App.Tag :text="s.environment === 'testing' ? 'Pruebas' : 'Prod'" :severity="s.environment === 'testing' ? 'secondary' : 'primary'" size="xs" />
              <App.Tag v-if="s.environment !== 'testing'" :text="s.subscription ? `${s.subscription.plan ?? ''} · ${subscriptionStatus(s.subscription.status).label}` : 'Sin suscripción'"
                :severity="subscriptionStatus(s.subscription?.status).severity" size="xs" />
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
