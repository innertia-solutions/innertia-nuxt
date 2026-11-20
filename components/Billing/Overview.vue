<script setup lang="ts">
import { IconDownload, IconCreditCard, IconFileInvoice } from '@tabler/icons-vue'
import {
  formatMoney, subscriptionStatus, invoiceStatus, periodLabel, formatDate, formatDateTime, paymentMethodLabel, paymentChannelLabel,
  bannerFor, type Invoice,
} from '../../composables/useBilling/internal/billing'

/*
 * Billing.Overview — "Facturación" of the backoffice (permission billing.view), read-only: plan and
 * status, consumption of the current period vs included with the estimate, invoices (PDF, due date,
 * "Pagar" when there is a payment link; in consolidated invoices, this space's part) and payments.
 * Testing spaces only show the "Espacio de pruebas" strip.
 * Backend: \Innertia\Billing\Routes::backoffice() → GET {endpoint}/overview|invoices|payments.
 *
 *   <Billing.Overview />
 */
const props = withDefaults(defineProps<{ endpoint?: string }>(), { endpoint: 'billing' })

const toast = useToast()
const { base, overview, invoices, payments } = useBillingSpace({ base: props.endpoint })
const savePdf = useBillingPdf()
const data = computed<any>(() => overview.data.value)
const list = computed<Invoice[]>(() => (invoices.data.value as Invoice[] | undefined) ?? [])
const paid = computed<any[]>(() => (payments.data.value as any[] | undefined) ?? [])
const banner = computed(() => bannerFor(data.value?.subscription?.status))

async function pdf(i: Invoice) {
  try {
    await savePdf(`${base}/invoices/${i.id}/pdf`, `factura-${i.display_number ?? i.id}.pdf`)
  } catch {
    toast.error('No se pudo descargar el PDF.')
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="overview.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
    <div v-else-if="overview.isError.value || !data" class="p-8 text-center text-sm text-muted-foreground">
      No se pudo cargar la facturación.
      <button type="button" class="text-primary hover:underline" @click="overview.refetch()">Reintentar</button>
    </div>

    <div v-else-if="data.testing" class="rounded-card border border-info/40 bg-info/5 p-4 text-sm text-foreground">
      Espacio de pruebas: no tiene facturación.
    </div>

    <template v-else>
      <div v-if="banner" class="rounded-card border p-4 text-sm" :class="banner.severity === 'danger' ? 'border-danger/40 bg-danger/5' : 'border-warning/40 bg-warning/5'">
        <p class="font-medium" :class="banner.severity === 'danger' ? 'text-danger' : 'text-warning'">{{ banner.title }}</p>
        <p class="text-foreground">{{ banner.message }}</p>
      </div>

      <div v-if="!data.subscription" class="bg-card border border-card-line rounded-card p-4 text-sm text-muted-foreground">
        Este espacio aún no tiene un plan asignado.
      </div>

      <template v-else>
        <div class="grid gap-3 sm:grid-cols-3">
          <App.StatCard label="Plan" :value="data.subscription.plan?.name ?? '—'" :hint="`${subscriptionStatus(data.subscription.status).label} · ${paymentMethodLabel(data.subscription.payment_method)}`" />
          <App.StatCard label="Total estimado del período" :value="formatMoney(data.estimate?.total ?? 0, data.estimate?.currency)" :hint="`${periodLabel(data.subscription.current_period_start, data.subscription.current_period_end)} · IVA incluido`" />
          <App.StatCard label="Saldo pendiente" :value="formatMoney(data.balance?.open ?? 0)" :value-class="(data.balance?.overdue ?? 0) > 0 ? 'text-danger' : 'text-foreground'"
            :hint="(data.balance?.overdue ?? 0) > 0 ? `${formatMoney(data.balance.overdue)} vencido` : (data.balance?.next_due_at ? `Próximo vencimiento ${formatDateTime(data.balance.next_due_at)}` : 'Al día')" />
        </div>

        <p v-if="data.subscription.status === 'trialing' && data.subscription.trial_ends_at" class="text-sm text-info">
          Período de prueba hasta el {{ formatDate(data.subscription.trial_ends_at) }}: no se cobra.
        </p>
        <p v-if="data.subscription.pending_plan" class="text-sm text-muted-foreground">Desde el próximo período: plan {{ data.subscription.pending_plan.name }}.</p>

        <div class="bg-card border border-card-line rounded-card p-4 space-y-3">
          <p class="text-sm font-medium text-foreground">Consumo del período</p>
          <p v-if="data.seats" class="text-sm text-muted-foreground">
            Usuarios: {{ data.seats.counted }} de {{ data.seats.included }} incluidos<template v-if="data.seats.seat_price && data.seats.counted > data.seats.included"> · adicionales {{ formatMoney(data.estimate.seats) }}</template>
          </p>
          <Billing.UsageTable :usage="data.usage ?? []" :currency="data.estimate?.currency" />
        </div>
      </template>

      <div class="bg-card border border-card-line rounded-card overflow-x-auto">
        <p class="text-sm font-medium text-foreground px-4 pt-3">Facturas</p>
        <div v-if="invoices.isPending.value" class="p-6 text-center text-sm text-muted-foreground">Cargando…</div>
        <div v-else-if="!list.length" class="p-6 text-center text-sm text-muted-foreground">
          <IconFileInvoice class="size-6 mx-auto mb-2" :stroke-width="1.5" />
          Aún no hay facturas.
        </div>
        <table v-else class="w-full text-sm">
          <tbody class="divide-y divide-card-line">
            <tr v-for="i in list" :key="i.id">
              <td class="px-4 py-2">
                <p class="font-medium text-foreground">{{ i.display_number }} <App.Tag :text="invoiceStatus(i.status).label" :severity="invoiceStatus(i.status).severity" size="xs" class="ml-1" /></p>
                <p class="text-xs text-muted-foreground">{{ periodLabel(i.period_start, i.period_end) }}<template v-if="i.consolidated"> · factura conjunta del cliente</template></p>
              </td>
              <td class="px-4 py-2 text-right">
                <p>{{ formatMoney(i.total, i.currency) }}</p>
                <p v-if="i.consolidated" class="text-xs text-muted-foreground">Este espacio: {{ formatMoney(i.space_part ?? 0, i.currency) }}</p>
              </td>
              <td class="px-4 py-2 text-muted-foreground">
                <template v-if="i.status === 'paid'">Pagada {{ formatDateTime(i.paid_at) }}</template>
                <template v-else>Vence {{ formatDateTime(i.due_at) }} · saldo {{ formatMoney(i.balance, i.currency) }}</template>
              </td>
              <td class="px-4 py-2">
                <div class="flex justify-end gap-1">
                  <App.Button v-if="i.payment_link" text="Pagar" size="xs" severity="primary" :icon="IconCreditCard" type="link" :link="i.payment_link" />
                  <App.Button text="PDF" size="xs" outline :icon="IconDownload" @click="pdf(i)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="paid.length" class="bg-card border border-card-line rounded-card">
        <p class="text-sm font-medium text-foreground px-4 pt-3">Pagos</p>
        <ul class="divide-y divide-card-line">
          <li v-for="p in paid" :key="p.id" class="flex items-center gap-3 px-4 py-2 text-sm">
            <span class="flex-1">{{ formatDateTime(p.received_at) }} · {{ paymentChannelLabel(p.method) }}<template v-if="p.reference"> · {{ p.reference }}</template></span>
            <span class="font-medium">{{ formatMoney(p.amount) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
