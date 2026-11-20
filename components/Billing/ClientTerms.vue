<script setup lang="ts">
import { errorMessage } from '../../composables/useBilling/internal/billing'

/*
 * Billing.ClientTerms — collection terms of a client: late fee interest (percent, per month or per day,
 * cap over the invoice total, exemption) and whether payment reminders are sent. Changes are audited.
 * Backend: GET|PUT {endpoint}/clients/{clientId}/terms.
 *
 *   <Billing.ClientTerms :client-id="client.id" :can-edit="isOwner" />
 */
const props = withDefaults(defineProps<{ endpoint?: string; clientId: string; canEdit?: boolean }>(), { endpoint: 'platform/billing', canEdit: true })

const toast = useToast()
const billing = useBillingPlatform({ base: props.endpoint })
const query = billing.terms(computed(() => props.clientId))
const form = reactive({ late_fee_percent: '' as string | number, late_fee_basis: 'monthly', late_fee_cap_percent: '' as string | number, late_fee_exempt: false, reminders_enabled: true })

watch(() => query.data.value, (t: any) => {
  if (t) Object.assign(form, { late_fee_percent: t.late_fee_percent ?? 0, late_fee_basis: t.late_fee_basis, late_fee_cap_percent: t.late_fee_cap_percent ?? '', late_fee_exempt: t.late_fee_exempt, reminders_enabled: t.reminders_enabled })
}, { immediate: true })

const example = computed(() => {
  const p = Number(form.late_fee_percent) || 0
  if (p <= 0 || form.late_fee_exempt) return 'Sin interés por mora.'
  const daily = form.late_fee_basis === 'daily' ? p : p / 30
  return `Una deuda vencida de $ 100.000 genera $ ${Math.round(100000 * daily / 100 * 30).toLocaleString('es-CL')} en 30 días (se cobra en el cierre siguiente).`
})

async function save() {
  try {
    await billing.saveTerms.mutateAsync({
      clientId: props.clientId,
      body: {
        late_fee_percent: Number(form.late_fee_percent) || 0,
        late_fee_basis: form.late_fee_basis,
        late_fee_cap_percent: form.late_fee_cap_percent === '' ? null : Number(form.late_fee_cap_percent),
        late_fee_exempt: form.late_fee_exempt,
        reminders_enabled: form.reminders_enabled,
      },
    })
    toast.success('Condiciones guardadas.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudieron guardar las condiciones.'))
  }
}

const inputClass = 'w-full h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
</script>

<template>
  <form class="bg-card border border-card-line rounded-card p-4 grid gap-3 sm:grid-cols-2 text-sm" @submit.prevent="save">
    <p class="sm:col-span-2 font-medium text-foreground">Interés por mora</p>
    <label class="block space-y-1"><span class="font-medium">Tasa (%)</span>
      <input v-model="form.late_fee_percent" type="number" min="0" max="50" step="0.01" :class="inputClass" :disabled="!canEdit" />
    </label>
    <label class="block space-y-1"><span class="font-medium">Base</span>
      <select v-model="form.late_fee_basis" :class="inputClass" :disabled="!canEdit"><option value="monthly">Mensual</option><option value="daily">Diaria</option></select>
    </label>
    <label class="block space-y-1"><span class="font-medium">Tope (% del total de la factura)</span>
      <input v-model="form.late_fee_cap_percent" type="number" min="0" step="0.01" :class="inputClass" :disabled="!canEdit" placeholder="Sin tope" />
    </label>
    <label class="flex items-center gap-2 self-end h-9"><input v-model="form.late_fee_exempt" type="checkbox" class="rounded" :disabled="!canEdit" /> Cliente exento de interés</label>
    <p class="sm:col-span-2 text-xs text-muted-foreground">{{ example }}</p>
    <p class="sm:col-span-2 font-medium text-foreground pt-2">Recordatorios</p>
    <label class="sm:col-span-2 flex items-center gap-2"><input v-model="form.reminders_enabled" type="checkbox" class="rounded" :disabled="!canEdit" /> Enviar recordatorios de pago por correo a este cliente</label>
    <div v-if="canEdit" class="sm:col-span-2 flex justify-end">
      <App.Button text="Guardar" severity="primary" size="sm" :loading="billing.saveTerms.isPending.value" @click="save" />
    </div>
  </form>
</template>
