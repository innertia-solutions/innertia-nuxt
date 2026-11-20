<script setup lang="ts">
import { formatDateTime, activityLabel, formatMoney } from '../../composables/useBilling/internal/billing'

/*
 * Billing.ActivityLog — collections audit log of a client (who did what: adjustments, credit notes,
 * voids and reissues, terms, reconciliations, waivers), newest first.
 * Backend: GET {endpoint}/activity?client_id=.
 *
 *   <Billing.ActivityLog :client-id="client.id" :users="{ [id]: name }" />
 */
const props = withDefaults(defineProps<{ endpoint?: string; clientId?: string | null; users?: Record<string, string> }>(), { endpoint: 'platform/billing', clientId: null, users: () => ({}) })

const billing = useBillingPlatform({ base: props.endpoint })
const page = ref(1)
const query = billing.activity(computed(() => ({ client_id: props.clientId, page: page.value })))
const rows = computed<any[]>(() => (query.data.value as any)?.data ?? [])
const meta = computed(() => (query.data.value as any)?.meta ?? { page: 1, last_page: 1 })

function detail(a: any): string {
  const d = a.data ?? {}
  const parts = [d.number, d.invoice, d.reason]
  if (typeof d.amount === 'number') parts.push(formatMoney(d.amount))
  return parts.filter(Boolean).join(' · ')
}
const who = (a: any) => !a.user_id ? 'Sistema' : (props.users[a.user_id] ?? `Usuario ${a.user_id}`)
</script>

<template>
  <div class="bg-card border border-card-line rounded-card">
    <div v-if="query.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
    <div v-else-if="!rows.length" class="p-8 text-center text-sm text-muted-foreground">Sin actividad de cobranza.</div>
    <ul v-else class="divide-y divide-card-line text-sm">
      <li v-for="a in rows" :key="a.id" class="px-4 py-2">
        <p class="text-foreground">{{ activityLabel(a.subject_type, a.action) }}<span v-if="detail(a)" class="text-muted-foreground"> · {{ detail(a) }}</span></p>
        <p class="text-xs text-muted-foreground">{{ formatDateTime(a.created_at) }} · {{ who(a) }}</p>
      </li>
    </ul>
    <div v-if="meta.last_page > 1" class="flex items-center justify-end gap-2 p-3 text-sm">
      <App.Button text="Anterior" size="xs" :disabled="page <= 1" @click="page--" />
      <span class="text-muted-foreground">Página {{ meta.page }} de {{ meta.last_page }}</span>
      <App.Button text="Siguiente" size="xs" :disabled="page >= meta.last_page" @click="page++" />
    </div>
  </div>
</template>
