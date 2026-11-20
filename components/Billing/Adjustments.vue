<script setup lang="ts">
import { IconPlus, IconReceiptRefund, IconX } from '@tabler/icons-vue'
import {
  ADJUSTMENT_TYPES, adjustmentTypeLabel, adjustmentValue, adjustmentStatus, adjustmentPayload, formatDate, formatDateTime,
  errorMessage, type Adjustment, type AdjustmentForm,
} from '../../composables/useBilling/internal/billing'

/*
 * Billing.Adjustments — discounts, surcharges, one-off charges and credits of a client's spaces (or of the
 * whole client: percent discounts/surcharges applied to every space), plus its credit notes. Every
 * adjustment carries reason and author; pending ones can be canceled. They enter the next closes.
 * Backend: GET|POST {endpoint}/adjustments, POST {endpoint}/adjustments/{id}/cancel, POST {endpoint}/credit-notes.
 *
 *   <Billing.Adjustments :client-id="client.id" :spaces="[{ value: 'rancagua', label: 'Rancagua' }]" />
 *   <Billing.Adjustments :client-id="client.id" space-key="rancagua" />     (inside a space detail)
 */
const props = withDefaults(defineProps<{
  endpoint?: string
  clientId: string
  spaceKey?: string | null
  spaces?: { value: string; label: string }[]
  canEdit?: boolean
}>(), { endpoint: 'platform/billing', spaceKey: null, spaces: () => [], canEdit: true })

const toast = useToast()
const { prompt } = useModal()
const billing = useBillingPlatform({ base: props.endpoint })

const status = ref<'' | 'pending' | 'applied' | 'canceled'>('')
const filters = computed(() => ({ client_id: props.spaceKey ? null : props.clientId, tenant_key: props.spaceKey, status: status.value }))
const query = billing.adjustments(filters)
const rows = computed<Adjustment[]>(() => (query.data.value as Adjustment[] | undefined) ?? [])
const spaceName = (a: Adjustment) => a.scope === 'client' ? 'Todo el cliente' : (props.spaces.find(s => s.value === a.tenant_id)?.label ?? props.spaceKey ?? 'Espacio')

const empty = (): AdjustmentForm => ({
  scope: 'space', tenant_key: props.spaceKey ?? props.spaces[0]?.value ?? '', type: 'discount', mode: 'amount', value: '',
  recurring: false, starts_at: '', ends_at: '', reason: '',
})
const form = reactive({ open: false, data: empty() })
const once = computed(() => form.data.type === 'one_off' || form.data.type === 'credit')

async function submit() {
  const { payload, error } = adjustmentPayload(form.data, props.clientId)
  if (error) { toast.error(error); return }
  try {
    await billing.createAdjustment.mutateAsync(payload)
    form.open = false
    toast.success('Ajuste creado. Se aplica en el próximo cierre.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo crear el ajuste.'))
  }
}

async function cancel(a: Adjustment) {
  const reason = await prompt({ title: 'Anular ajuste', message: `${adjustmentTypeLabel(a.type)} "${a.reason}". Indica el motivo.`, required: true, confirmText: 'Anular' })
  if (!reason) return
  try {
    await billing.cancelAdjustment.mutateAsync({ id: a.id, reason })
    toast.success('Ajuste anulado.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo anular.'))
  }
}

const creditNoteOpen = ref(false)
const inputClass = 'w-full h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-3">
      <label class="space-y-1">
        <span class="text-xs text-muted-foreground">Estado</span>
        <select v-model="status" :class="inputClass">
          <option value="">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="applied">Aplicados</option>
          <option value="canceled">Anulados</option>
        </select>
      </label>
      <span class="flex-1" />
      <App.Button v-if="canEdit" text="Nota de crédito" size="sm" :icon="IconReceiptRefund" @click="creditNoteOpen = true" />
      <App.Button v-if="canEdit" text="Nuevo ajuste" size="sm" severity="primary" :icon="IconPlus" @click="form.data = empty(); form.open = true" />
    </div>

    <div class="bg-card border border-card-line rounded-card overflow-x-auto">
      <div v-if="query.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="query.isError.value" class="p-8 text-center text-sm text-muted-foreground">
        No se pudieron cargar los ajustes.
        <button type="button" class="text-primary hover:underline" @click="query.refetch()">Reintentar</button>
      </div>
      <div v-else-if="!rows.length" class="p-8 text-center text-sm text-muted-foreground">Sin ajustes ni notas de crédito.</div>
      <table v-else class="w-full text-sm">
        <thead class="text-xs uppercase text-muted-foreground">
          <tr class="border-b border-card-line">
            <th class="text-left font-medium px-4 py-2">Ajuste</th>
            <th class="text-left font-medium px-4 py-2">Alcance</th>
            <th class="text-right font-medium px-4 py-2">Valor</th>
            <th class="text-left font-medium px-4 py-2">Vigencia</th>
            <th class="text-left font-medium px-4 py-2">Motivo</th>
            <th class="px-4 py-2" />
          </tr>
        </thead>
        <tbody class="divide-y divide-card-line">
          <tr v-for="a in rows" :key="a.id">
            <td class="px-4 py-2">
              <p class="font-medium text-foreground">{{ a.credit_note ? `Nota de crédito ${a.display_number}` : adjustmentTypeLabel(a.type) }}</p>
              <App.Tag :text="adjustmentStatus(a.status).label" :severity="adjustmentStatus(a.status).severity" size="xs" />
            </td>
            <td class="px-4 py-2 text-muted-foreground">{{ spaceName(a) }}</td>
            <td class="px-4 py-2 text-right whitespace-nowrap">{{ adjustmentValue(a) }}</td>
            <td class="px-4 py-2 text-muted-foreground">
              <template v-if="a.credit_note">{{ a.target === 'invoice' ? 'A factura' : a.target === 'balance' ? 'Saldo a favor' : 'Próximo cobro' }}</template>
              <template v-else-if="a.recurring">Recurrente {{ a.starts_at ? `desde ${formatDate(a.starts_at)}` : '' }} {{ a.ends_at ? `hasta ${formatDate(a.ends_at)}` : '(sin término)' }}</template>
              <template v-else>Una vez</template>
            </td>
            <td class="px-4 py-2">
              <p>{{ a.reason }}</p>
              <p class="text-xs text-muted-foreground">{{ formatDateTime(a.created_at) }}<template v-if="a.cancel_reason"> · anulado: {{ a.cancel_reason }}</template></p>
            </td>
            <td class="px-4 py-2 text-right">
              <App.Button v-if="canEdit && a.status === 'pending'" text="Anular" size="xs" outline :icon="IconX" @click="cancel(a)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Modal v-model="form.open" title="Nuevo ajuste" size="md" show-footer>
      <div class="space-y-3 text-sm">
        <div v-if="!spaceKey" class="flex gap-4">
          <label class="flex items-center gap-2"><input v-model="form.data.scope" type="radio" value="space" /> Un espacio</label>
          <label class="flex items-center gap-2"><input v-model="form.data.scope" type="radio" value="client" /> Todo el cliente (porcentaje)</label>
        </div>
        <label v-if="form.data.scope === 'space' && !spaceKey" class="block space-y-1"><span class="font-medium">Espacio</span>
          <select v-model="form.data.tenant_key" :class="inputClass"><option v-for="s in spaces" :key="s.value" :value="s.value">{{ s.label }}</option></select>
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block space-y-1"><span class="font-medium">Tipo</span>
            <select v-model="form.data.type" :class="inputClass">
              <option v-for="t in ADJUSTMENT_TYPES" :key="t.value" :value="t.value" :disabled="form.data.scope === 'client' && !['discount', 'surcharge'].includes(t.value)">{{ t.label }}</option>
            </select>
          </label>
          <label class="block space-y-1"><span class="font-medium">Cálculo</span>
            <select v-model="form.data.mode" :class="inputClass">
              <option value="amount" :disabled="form.data.scope === 'client'">Monto neto ($)</option>
              <option value="percent">Porcentaje (%)</option>
            </select>
          </label>
        </div>
        <label class="block space-y-1"><span class="font-medium">{{ form.data.mode === 'percent' ? 'Porcentaje' : 'Monto (antes de IVA)' }}</span>
          <input v-model="form.data.value" inputmode="decimal" :class="inputClass" />
        </label>
        <label v-if="!once" class="flex items-center gap-2"><input v-model="form.data.recurring" type="checkbox" class="rounded" /> Recurrente (se aplica en cada cierre dentro de la vigencia)</label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block space-y-1"><span class="font-medium">Desde</span><input v-model="form.data.starts_at" type="date" :class="inputClass" /></label>
          <label v-if="!once" class="block space-y-1"><span class="font-medium">Hasta</span><input v-model="form.data.ends_at" type="date" :class="inputClass" /></label>
        </div>
        <label class="block space-y-1"><span class="font-medium">Motivo</span><input v-model="form.data.reason" :class="inputClass" maxlength="250" placeholder="Aparece como línea del cobro" /></label>
      </div>
      <template #footer>
        <App.Button text="Cancelar" size="sm" @click="form.open = false" />
        <App.Button text="Crear ajuste" severity="primary" size="sm" :loading="billing.createAdjustment.isPending.value" @click="submit" />
      </template>
    </Modal>

    <Billing.CreditNoteForm v-model="creditNoteOpen" :endpoint="endpoint" :client-id="clientId" :spaces="spaceKey ? [{ value: spaceKey, label: spaceKey }] : spaces" />
  </div>
</template>
