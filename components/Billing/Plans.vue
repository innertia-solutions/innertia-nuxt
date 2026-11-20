<script setup lang="ts">
import { IconPlus, IconPencil, IconTrash, IconReceipt } from '@tabler/icons-vue'
import {
  formatMoney, intervalLabel, emptyPlan, planPayload, errorMessage, type Plan, type MeterDefinition,
} from '../../composables/useBilling/internal/billing'

/*
 * Billing.Plans — plans and prices (platform): base price, included seats + seat price, trial,
 * VAT and metered consumption (included + unit price; AI at real cost + markup %).
 * Prices in pesos (integers). Changes rule from the next period close.
 * Backend: \Innertia\Billing\Routes::platform() + platformWrite().
 *
 *   <Billing.Plans endpoint="platform/billing" :can-edit="isOwner" />
 */
const props = withDefaults(defineProps<{ endpoint?: string; canEdit?: boolean }>(), { endpoint: 'platform/billing', canEdit: true })

const toast = useToast()
const { plans, meters, savePlan } = useBillingPlatform({ base: props.endpoint })
const list = computed<Plan[]>(() => (plans.data.value as Plan[] | undefined) ?? [])
const catalog = computed<MeterDefinition[]>(() => (meters.data.value as MeterDefinition[] | undefined) ?? [])
const meterDef = (key: string) => catalog.value.find(m => m.key === key)

const show = ref(false)
const editing = ref<Plan | null>(null)
const form = reactive<Omit<Plan, 'id'>>(emptyPlan())

function open(plan: Plan | null) {
  editing.value = plan
  Object.assign(form, plan ? JSON.parse(JSON.stringify({ ...plan, description: plan.description ?? '', product: plan.product ?? '' })) : emptyPlan())
  show.value = true
}

function addMeter() {
  const used = new Set(form.meters.map(m => m.meter))
  const next = catalog.value.find(m => !used.has(m.key))
  form.meters.push({ meter: next?.key ?? '', included_quantity: 0, unit_price: 0, markup_percent: next?.valued_by_cost ? 20 : null })
}

async function submit() {
  if (!form.name.trim() || !form.key.trim()) { toast.error('Nombre y clave son obligatorios.'); return }
  try {
    await savePlan.mutateAsync({ id: editing.value?.id, body: planPayload(form, catalog.value) })
    show.value = false
    toast.success(editing.value ? 'Plan actualizado.' : 'Plan creado.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo guardar el plan.'))
  }
}

const inputClass = 'w-full h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <p class="flex-1 text-sm text-muted-foreground">
        Cada espacio de producción se cobra con un plan: precio base, usuarios adicionales y consumo medido. Los montos van en pesos; los cambios rigen desde el próximo cierre.
      </p>
      <App.Button v-if="canEdit" text="Nuevo plan" severity="primary" size="sm" :icon="IconPlus" @click="open(null)" />
    </div>

    <div class="bg-card border border-card-line rounded-card overflow-hidden">
      <div v-if="plans.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="plans.isError.value" class="p-8 text-center text-sm text-muted-foreground">
        No se pudieron cargar los planes.
        <button type="button" class="text-primary hover:underline" @click="plans.refetch()">Reintentar</button>
      </div>
      <div v-else-if="!list.length" class="p-8 text-center text-sm text-muted-foreground">
        <IconReceipt class="size-6 mx-auto mb-2" :stroke-width="1.5" />
        Aún no hay planes.
      </div>
      <ul v-else class="divide-y divide-card-line">
        <li v-for="p in list" :key="p.id" class="flex flex-wrap items-start gap-3 px-5 py-3">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-foreground flex items-center gap-2">
              {{ p.name }} <span class="text-xs font-mono text-muted-foreground">{{ p.key }}</span>
              <App.Tag v-if="!p.active" text="Inactivo" size="xs" />
            </p>
            <p class="text-xs text-muted-foreground">
              {{ formatMoney(p.base_price, p.currency) }} {{ intervalLabel(p.interval) }} + IVA {{ p.tax_rate }} %
              · {{ p.included_seats }} usuarios incluidos<template v-if="p.seat_price">, adicional {{ formatMoney(p.seat_price, p.currency) }}</template>
              <template v-if="p.trial_days"> · {{ p.trial_days }} días de prueba</template>
            </p>
            <p v-if="p.meters.length" class="text-xs text-muted-foreground">
              <template v-for="(m, i) in p.meters" :key="m.meter">
                {{ i ? ' · ' : '' }}{{ m.label ?? m.meter }}:
                <template v-if="m.valued_by_cost">costo + {{ m.markup_percent ?? 0 }} %</template>
                <template v-else>{{ m.included_quantity }} incluidos, {{ formatMoney(m.unit_price, p.currency) }} c/u</template>
              </template>
            </p>
          </div>
          <App.Button v-if="canEdit" text="Editar" size="xs" :icon="IconPencil" @click="open(p)" />
        </li>
      </ul>
    </div>

    <Modal v-model="show" :title="editing ? 'Editar plan' : 'Nuevo plan'" size="2xl" show-footer>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block space-y-1"><span class="text-sm font-medium">Nombre</span><input v-model="form.name" :class="inputClass" maxlength="120" /></label>
          <label class="block space-y-1"><span class="text-sm font-medium">Clave</span><input v-model="form.key" :class="inputClass" maxlength="60" placeholder="pro" /></label>
          <label class="block space-y-1 sm:col-span-2"><span class="text-sm font-medium">Descripción</span><input v-model="form.description" :class="inputClass" maxlength="250" /></label>
          <label class="block space-y-1"><span class="text-sm font-medium">Periodicidad</span>
            <select v-model="form.interval" :class="inputClass"><option value="monthly">Mensual</option><option value="annual">Anual</option></select>
          </label>
          <label class="block space-y-1"><span class="text-sm font-medium">Precio base ($)</span><input v-model.number="form.base_price" type="number" min="0" step="1" :class="inputClass" /></label>
          <label class="block space-y-1"><span class="text-sm font-medium">Usuarios incluidos</span><input v-model.number="form.included_seats" type="number" min="0" :class="inputClass" /></label>
          <label class="block space-y-1"><span class="text-sm font-medium">Precio por usuario adicional ($)</span><input v-model.number="form.seat_price" type="number" min="0" :class="inputClass" /></label>
          <label class="block space-y-1"><span class="text-sm font-medium">Días de prueba</span><input v-model.number="form.trial_days" type="number" min="0" max="365" :class="inputClass" /></label>
          <label class="block space-y-1"><span class="text-sm font-medium">IVA (%)</span><input v-model.number="form.tax_rate" type="number" min="0" max="100" step="0.01" :class="inputClass" /></label>
          <label class="flex items-center gap-2 text-sm sm:col-span-2"><input v-model="form.active" type="checkbox" class="rounded" /> Plan activo (disponible para nuevas suscripciones)</label>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Consumo medido</span>
            <App.Button text="Agregar medidor" size="xs" :icon="IconPlus" :disabled="form.meters.length >= catalog.length" @click="addMeter" />
          </div>
          <p v-if="!form.meters.length" class="text-xs text-muted-foreground">Sin consumo medido: solo se cobra base y usuarios.</p>
          <div v-for="(m, i) in form.meters" :key="i" class="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto] items-end border border-card-line rounded-control p-2">
            <label class="block space-y-1"><span class="text-xs text-muted-foreground">Medidor</span>
              <select v-model="m.meter" :class="inputClass">
                <option v-for="d in catalog" :key="d.key" :value="d.key">{{ d.label }}</option>
              </select>
            </label>
            <template v-if="meterDef(m.meter)?.valued_by_cost">
              <label class="block space-y-1"><span class="text-xs text-muted-foreground">Margen (%)</span><input v-model.number="m.markup_percent" type="number" min="0" :class="inputClass" /></label>
              <label class="block space-y-1"><span class="text-xs text-muted-foreground">Incluido ($)</span><input v-model.number="m.included_quantity" type="number" min="0" :class="inputClass" /></label>
            </template>
            <template v-else>
              <label class="block space-y-1"><span class="text-xs text-muted-foreground">Incluido ({{ meterDef(m.meter)?.unit ?? 'unidad' }})</span><input v-model.number="m.included_quantity" type="number" min="0" step="any" :class="inputClass" /></label>
              <label class="block space-y-1"><span class="text-xs text-muted-foreground">Precio unitario ($)</span><input v-model.number="m.unit_price" type="number" min="0" :class="inputClass" /></label>
            </template>
            <button type="button" class="p-2 text-muted-foreground hover:text-danger" aria-label="Quitar medidor" @click="form.meters.splice(i, 1)">
              <IconTrash class="size-4" />
            </button>
          </div>
        </div>
      </form>
      <template #footer>
        <App.Button text="Cancelar" size="sm" @click="show = false" />
        <App.Button text="Guardar" severity="primary" size="sm" :loading="savePlan.isPending.value" @click="submit" />
      </template>
    </Modal>
  </div>
</template>
