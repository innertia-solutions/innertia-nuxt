<script setup lang="ts">
import { IconDownload, IconCoin } from '@tabler/icons-vue'
import { formatMoney, formatDate, movementLabel, AGING_BUCKETS, errorMessage } from '../../composables/useBilling/internal/billing'

/*
 * Billing.AccountStatement — estado de cuenta: charges, credits and running balance (opening balance with
 * "desde"), credit in favor, aging of the open debt (not due, 0–30, 31–60, 61–90, 90+) and open invoices.
 *   platform:   <Billing.AccountStatement :client-id="client.id" />           (whole client; xlsx export,
 *               "Aplicar saldo a favor"; space-key narrows to one space)
 *   backoffice: <Billing.AccountStatement mode="space" />                     (active space, read-only)
 * Backend: GET {endpoint}/clients/{id}/account(/export) · POST …/apply-credit — backoffice GET {endpoint}/account.
 */
const props = withDefaults(defineProps<{
  endpoint?: string
  mode?: 'client' | 'space'
  clientId?: string | null
  spaceKey?: string | null
  canEdit?: boolean
}>(), { endpoint: undefined, mode: 'client', clientId: null, spaceKey: null, canEdit: true })

const toast = useToast()
const range = reactive({ from: '', to: '' })
const params = computed(() => ({ from: range.from, to: range.to, tenant_key: props.spaceKey }))
const isSpace = props.mode === 'space'
const platform = isSpace ? null : useBillingPlatform({ base: props.endpoint ?? 'platform/billing' })
const space = isSpace ? useBillingSpace({ base: props.endpoint ?? 'billing' }) : null
const query = isSpace
  ? space!.account(computed(() => ({ from: range.from, to: range.to })))
  : platform!.account(computed(() => props.clientId ?? ''), params)
const data = computed<any>(() => query.data.value)
const download = useBillingDownload()

async function exportXlsx() {
  if (!platform || !props.clientId) return
  try {
    await download(`${platform.base}/clients/${props.clientId}/account/export`, `estado-de-cuenta.xlsx`, params.value)
  } catch {
    toast.error('No se pudo descargar el estado de cuenta.')
  }
}

async function applyCredit() {
  if (!platform || !props.clientId) return
  try {
    const res = await platform.applyCredit.mutateAsync({ clientId: props.clientId })
    toast.success(res.applied > 0 ? `Saldo a favor aplicado: ${formatMoney(res.applied)}.` : 'No hay facturas abiertas para aplicar el saldo.')
    query.refetch()
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo aplicar el saldo a favor.'))
  }
}

const inputClass = 'h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-3 text-sm">
      <label class="space-y-1"><span class="block text-xs text-muted-foreground">Desde</span><input v-model="range.from" type="date" :class="inputClass" /></label>
      <label class="space-y-1"><span class="block text-xs text-muted-foreground">Hasta</span><input v-model="range.to" type="date" :class="inputClass" /></label>
      <span class="flex-1" />
      <App.Button v-if="!isSpace && canEdit && (data?.credit_available ?? 0) > 0" text="Aplicar saldo a favor" size="sm" :icon="IconCoin" :loading="platform?.applyCredit.isPending.value" @click="applyCredit" />
      <App.Button v-if="!isSpace" text="Excel" size="sm" outline :icon="IconDownload" @click="exportXlsx" />
    </div>

    <div v-if="query.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
    <div v-else-if="query.isError.value || !data" class="p-8 text-center text-sm text-muted-foreground">
      No se pudo cargar el estado de cuenta.
      <button type="button" class="text-primary hover:underline" @click="query.refetch()">Reintentar</button>
    </div>
    <div v-else-if="data.testing" class="rounded-card border border-info/40 bg-info/5 p-4 text-sm">Espacio de pruebas: no tiene facturación.</div>

    <template v-else>
      <div class="grid gap-3 sm:grid-cols-3">
        <App.StatCard label="Saldo" :value="formatMoney(data.closing_balance, data.currency)" :value-class="data.closing_balance > 0 ? 'text-foreground' : 'text-success'"
          :hint="data.closing_balance < 0 ? 'A favor del cliente' : 'Cargos menos abonos'" />
        <App.StatCard label="Deuda abierta" :value="formatMoney(data.open_balance, data.currency)" :value-class="data.aging.total - data.aging.current > 0 ? 'text-danger' : 'text-foreground'"
          :hint="`${formatMoney(data.aging.total - data.aging.current, data.currency)} vencido`" />
        <App.StatCard v-if="data.credit_available !== null" label="Saldo a favor disponible" :value="formatMoney(data.credit_available, data.currency)" hint="Se aplica a la próxima factura emitida" />
      </div>

      <div class="bg-card border border-card-line rounded-card p-4">
        <p class="text-sm font-medium text-foreground mb-2">Antigüedad de la deuda</p>
        <div class="grid gap-2 grid-cols-2 sm:grid-cols-5 text-sm">
          <div v-for="b in AGING_BUCKETS" :key="b.key">
            <p class="text-xs text-muted-foreground">{{ b.label }}</p>
            <p :class="b.key !== 'current' && data.aging[b.key] > 0 ? 'text-danger font-medium' : ''">{{ formatMoney(data.aging[b.key], data.currency) }}</p>
          </div>
        </div>
      </div>

      <div class="bg-card border border-card-line rounded-card overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs uppercase text-muted-foreground">
            <tr class="border-b border-card-line">
              <th class="text-left font-medium px-4 py-2">Fecha</th>
              <th class="text-left font-medium px-4 py-2">Detalle</th>
              <th class="text-right font-medium px-4 py-2">Cargo</th>
              <th class="text-right font-medium px-4 py-2">Abono</th>
              <th class="text-right font-medium px-4 py-2">Saldo</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-card-line">
            <tr v-if="range.from" class="text-muted-foreground">
              <td class="px-4 py-2">{{ formatDate(range.from) }}</td><td class="px-4 py-2">Saldo inicial</td><td /><td />
              <td class="px-4 py-2 text-right">{{ formatMoney(data.opening_balance, data.currency) }}</td>
            </tr>
            <tr v-if="!data.movements.length"><td colspan="5" class="p-6 text-center text-muted-foreground">Sin movimientos en el rango.</td></tr>
            <tr v-for="(m, idx) in data.movements" :key="idx">
              <td class="px-4 py-2 whitespace-nowrap text-muted-foreground">{{ formatDate(m.date) }}</td>
              <td class="px-4 py-2"><span class="text-xs text-muted-foreground mr-1">{{ movementLabel(m.type) }}</span>{{ m.description }}</td>
              <td class="px-4 py-2 text-right">{{ m.charge ? formatMoney(m.charge, data.currency) : '' }}</td>
              <td class="px-4 py-2 text-right text-success">{{ m.credit ? formatMoney(m.credit, data.currency) : '' }}</td>
              <td class="px-4 py-2 text-right font-medium">{{ formatMoney(m.balance, data.currency) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
