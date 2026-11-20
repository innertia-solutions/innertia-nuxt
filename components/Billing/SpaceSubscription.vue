<script setup lang="ts">
import { IconPlayerPause, IconPlayerPlay, IconX } from '@tabler/icons-vue'
import {
  formatMoney, subscriptionStatus, periodLabel, formatDate, paymentMethodLabel, parseMoney, errorMessage,
  PAYMENT_METHODS, type Plan, type Subscription, type Statement,
} from '../../composables/useBilling/internal/billing'

/*
 * Billing.SpaceSubscription — subscription of one space (platform › client › space): start it
 * (plan, payment method, trial, negotiated prices), change plan (rules from the next period),
 * payment method, suspend / reactivate / cancel, consumption of the period with the estimate and
 * the closed statements. Testing spaces show a notice: they are never billed.
 * Backend: GET {endpoint}/spaces/{key} + writes of \Innertia\Billing\Routes::platformWrite().
 *
 *   <Billing.SpaceSubscription space-key="rancagua" :can-edit="isOwner" />
 */
const props = withDefaults(defineProps<{ spaceKey: string; endpoint?: string; canEdit?: boolean }>(), { endpoint: 'platform/billing', canEdit: true })

const toast = useToast()
const { confirm } = useModal()
const billing = useBillingPlatform({ base: props.endpoint })
const key = computed(() => props.spaceKey)
const query = billing.space(key)
const data = computed<any>(() => query.data.value)
const sub = computed<Subscription | null>(() => data.value?.subscription ?? null)
const plans = computed<Plan[]>(() => ((billing.plans.data.value as Plan[] | undefined) ?? []).filter(p => p.active))
const statements = computed<Statement[]>(() => data.value?.statements ?? [])

// ── Start ─────────────────────────────────────────────────────────────────
const start = reactive({ open: false, plan_id: '', payment_method: 'invoice', trial_days: '' as string | number, starts_at: '', base_price: '', seat_price: '' })
function openStart() {
  Object.assign(start, { open: true, plan_id: plans.value[0]?.id ?? '', payment_method: 'invoice', trial_days: '', starts_at: new Date().toISOString().slice(0, 10), base_price: '', seat_price: '' })
}
function overridesFrom(base: string, seat: string) {
  const o: Record<string, number> = {}
  const b = parseMoney(base); const s = parseMoney(seat)
  if (b !== null && !Number.isNaN(b)) o.base_price = b
  if (s !== null && !Number.isNaN(s)) o.seat_price = s
  return o
}
async function submitStart() {
  if (!start.plan_id) { toast.error('Elige un plan.'); return }
  try {
    await billing.startSubscription.mutateAsync({ key: props.spaceKey, body: {
      plan_id: start.plan_id, payment_method: start.payment_method, starts_at: start.starts_at || null,
      trial_days: start.trial_days === '' ? null : Number(start.trial_days), overrides: overridesFrom(start.base_price, start.seat_price),
    } })
    start.open = false
    toast.success('Suscripción iniciada.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo iniciar la suscripción.'))
  }
}

// ── Edit ──────────────────────────────────────────────────────────────────
const edit = reactive({ open: false, plan_id: '', payment_method: 'invoice', base_price: '', seat_price: '' })
function openEdit() {
  const s = sub.value!
  Object.assign(edit, {
    open: true, plan_id: s.pending_plan?.id ?? s.plan?.id ?? '', payment_method: s.payment_method,
    base_price: s.overrides?.base_price ?? '', seat_price: s.overrides?.seat_price ?? '',
  })
}
async function submitEdit() {
  const overrides = { ...(sub.value?.overrides ?? {}) }
  delete overrides.base_price; delete overrides.seat_price
  try {
    await billing.updateSubscription.mutateAsync({ key: props.spaceKey, body: {
      plan_id: edit.plan_id, payment_method: edit.payment_method,
      overrides: { ...overrides, ...overridesFrom(String(edit.base_price), String(edit.seat_price)) },
    } })
    edit.open = false
    toast.success('Suscripción actualizada.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo actualizar la suscripción.'))
  }
}

async function act(action: 'suspend' | 'reactivate' | 'cancel') {
  const texts = {
    suspend: ['Suspender espacio', 'El espacio quedará en solo lectura hasta que lo reactives.', 'Suspender', 'warning'],
    reactivate: ['Reactivar espacio', 'El espacio vuelve a operar. Si aún tiene facturas vencidas quedará "con deuda vencida".', 'Reactivar', 'primary'],
    cancel: ['Cancelar suscripción', 'Se deja de cobrar al espacio desde ahora. Puedes iniciar otra suscripción después.', 'Cancelar suscripción', 'danger'],
  }[action]
  if (!(await confirm({ title: texts[0], message: texts[1], confirmText: texts[2], severity: texts[3] }))) return
  try {
    await billing.subscriptionAction.mutateAsync({ key: props.spaceKey, action })
    toast.success('Listo.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo completar la acción.'))
  }
}

const inputClass = 'w-full h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
</script>

<template>
  <div class="space-y-4">
    <div v-if="query.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
    <div v-else-if="query.isError.value || !data" class="p-8 text-center text-sm text-muted-foreground">
      No se pudo cargar la facturación del espacio.
      <button type="button" class="text-primary hover:underline" @click="query.refetch()">Reintentar</button>
    </div>

    <div v-else-if="data.testing" class="rounded-card border border-info/40 bg-info/5 p-4 text-sm text-foreground">
      Espacio de pruebas: no tiene suscripción y nunca se cobra.
    </div>

    <template v-else>
      <div class="bg-card border border-card-line rounded-card p-4">
        <div v-if="!sub" class="flex flex-wrap items-center gap-3">
          <p class="flex-1 text-sm text-muted-foreground">El espacio no tiene suscripción: no se cobra ni se bloquea.</p>
          <App.Button v-if="canEdit" text="Iniciar suscripción" severity="primary" size="sm" @click="openStart" />
        </div>
        <div v-else class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-base font-medium text-foreground">{{ sub.plan?.name }}</p>
            <App.Tag :text="subscriptionStatus(sub.status).label" :severity="subscriptionStatus(sub.status).severity" size="xs" />
            <App.Tag v-if="sub.suspended_manually" text="Suspendido a mano" size="xs" />
            <span class="flex-1" />
            <template v-if="canEdit && sub.status !== 'canceled'">
              <App.Button text="Editar" size="xs" @click="openEdit" />
              <App.Button v-if="sub.status !== 'suspended'" text="Suspender" size="xs" :icon="IconPlayerPause" @click="act('suspend')" />
              <App.Button v-else text="Reactivar" size="xs" :icon="IconPlayerPlay" @click="act('reactivate')" />
              <App.Button text="Cancelar" size="xs" severity="danger" outline :icon="IconX" @click="act('cancel')" />
            </template>
            <App.Button v-if="canEdit && sub.status === 'canceled'" text="Nueva suscripción" size="xs" severity="primary" @click="openStart" />
          </div>
          <p class="text-sm text-muted-foreground">
            Período {{ periodLabel(sub.current_period_start, sub.current_period_end) }} · {{ paymentMethodLabel(sub.payment_method) }}
            <template v-if="sub.trial_ends_at && sub.status === 'trialing'"> · prueba hasta {{ formatDate(sub.trial_ends_at) }}</template>
          </p>
          <p v-if="sub.pending_plan" class="text-sm text-warning">Cambia a {{ sub.pending_plan.name }} desde el próximo período.</p>
          <p v-if="sub.overrides?.base_price !== undefined || sub.overrides?.seat_price !== undefined" class="text-xs text-muted-foreground">
            Precio negociado:
            <template v-if="sub.overrides.base_price !== undefined">base {{ formatMoney(sub.overrides.base_price) }}</template>
            <template v-if="sub.overrides.seat_price !== undefined"> · usuario adicional {{ formatMoney(sub.overrides.seat_price) }}</template>
          </p>
        </div>
      </div>

      <div v-if="sub && data.estimate" class="bg-card border border-card-line rounded-card p-4 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-foreground">Consumo del período (estimado)</p>
          <p class="text-sm">Total estimado <span class="font-medium">{{ formatMoney(data.estimate.total, data.estimate.currency) }}</span> <span class="text-xs text-muted-foreground">IVA incl.</span></p>
        </div>
        <p class="text-xs text-muted-foreground">
          Base {{ formatMoney(data.estimate.base) }} · Usuarios {{ data.seats?.counted }} de {{ data.seats?.included }} incluidos ({{ formatMoney(data.estimate.seats) }}) · Consumo {{ formatMoney(data.estimate.usage) }}
        </p>
        <Billing.UsageTable :usage="data.usage" :currency="data.estimate.currency" />
      </div>

      <div v-if="statements.length" class="bg-card border border-card-line rounded-card">
        <p class="text-sm font-medium text-foreground px-4 pt-3">Cobros cerrados</p>
        <ul class="divide-y divide-card-line">
          <li v-for="s in statements" :key="s.id" class="flex items-center gap-3 px-4 py-2 text-sm">
            <span class="flex-1">{{ periodLabel(s.period_start, s.period_end) }}</span>
            <span class="text-xs text-muted-foreground">{{ s.invoice_id ? 'Facturado' : 'Sin factura (monto 0)' }}</span>
            <span class="w-28 text-right font-medium">{{ formatMoney(s.total) }}</span>
          </li>
        </ul>
      </div>
    </template>

    <Modal v-model="start.open" title="Iniciar suscripción" size="lg" show-footer>
      <div class="grid gap-3 sm:grid-cols-2 text-sm">
        <label class="block space-y-1 sm:col-span-2"><span class="font-medium">Plan</span>
          <select v-model="start.plan_id" :class="inputClass"><option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }} · {{ formatMoney(p.base_price, p.currency) }}</option></select>
        </label>
        <label class="block space-y-1 sm:col-span-2"><span class="font-medium">Modo de pago</span>
          <select v-model="start.payment_method" :class="inputClass"><option v-for="m in PAYMENT_METHODS" :key="m.value" :value="m.value">{{ m.label }}</option></select>
        </label>
        <label class="block space-y-1"><span class="font-medium">Inicio</span><input v-model="start.starts_at" type="date" :class="inputClass" /></label>
        <label class="block space-y-1"><span class="font-medium">Días de prueba</span><input v-model="start.trial_days" type="number" min="0" placeholder="Los del plan" :class="inputClass" /></label>
        <label class="block space-y-1"><span class="font-medium">Precio base negociado ($)</span><input v-model="start.base_price" inputmode="numeric" placeholder="El del plan" :class="inputClass" /></label>
        <label class="block space-y-1"><span class="font-medium">Usuario adicional negociado ($)</span><input v-model="start.seat_price" inputmode="numeric" placeholder="El del plan" :class="inputClass" /></label>
      </div>
      <template #footer>
        <App.Button text="Cancelar" size="sm" @click="start.open = false" />
        <App.Button text="Iniciar" severity="primary" size="sm" :loading="billing.startSubscription.isPending.value" @click="submitStart" />
      </template>
    </Modal>

    <Modal v-model="edit.open" title="Editar suscripción" size="lg" show-footer>
      <div class="grid gap-3 sm:grid-cols-2 text-sm">
        <label class="block space-y-1 sm:col-span-2"><span class="font-medium">Plan</span>
          <select v-model="edit.plan_id" :class="inputClass"><option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }}</option></select>
          <span class="text-xs text-muted-foreground">Un cambio de plan rige desde el próximo período, sin prorrateo.</span>
        </label>
        <label class="block space-y-1 sm:col-span-2"><span class="font-medium">Modo de pago</span>
          <select v-model="edit.payment_method" :class="inputClass"><option v-for="m in PAYMENT_METHODS" :key="m.value" :value="m.value">{{ m.label }}</option></select>
        </label>
        <label class="block space-y-1"><span class="font-medium">Precio base negociado ($)</span><input v-model="edit.base_price" inputmode="numeric" placeholder="El del plan" :class="inputClass" /></label>
        <label class="block space-y-1"><span class="font-medium">Usuario adicional negociado ($)</span><input v-model="edit.seat_price" inputmode="numeric" placeholder="El del plan" :class="inputClass" /></label>
      </div>
      <template #footer>
        <App.Button text="Cancelar" size="sm" @click="edit.open = false" />
        <App.Button text="Guardar" severity="primary" size="sm" :loading="billing.updateSubscription.isPending.value" @click="submitEdit" />
      </template>
    </Modal>
  </div>
</template>
