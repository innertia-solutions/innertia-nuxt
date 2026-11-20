<script setup lang="ts">
import { CREDIT_NOTE_TARGETS, creditNotePayload, formatMoney, errorMessage, type CreditNoteForm, type Invoice } from '../../composables/useBilling/internal/billing'

/*
 * Billing.CreditNoteForm — modal to create a credit note (NC-000001) with reason: to an open invoice
 * (amount with VAT), to the client balance (credit for the next invoice) or to the next charge of a
 * space (net amount). With `invoice` it opens fixed on that invoice.
 * Backend: POST {endpoint}/credit-notes; open invoices from GET {endpoint}/reconciliation/open-invoices.
 *
 *   <Billing.CreditNoteForm v-model="open" :client-id="client.id" :spaces="spaces" />
 *   <Billing.CreditNoteForm v-model="open" :client-id="invoice.client_id" :invoice="invoice" @created="reload" />
 */
const props = withDefaults(defineProps<{
  endpoint?: string
  clientId: string
  invoice?: Invoice | null
  spaces?: { value: string; label: string }[]
}>(), { endpoint: 'platform/billing', invoice: null, spaces: () => [] })
const emit = defineEmits<{ created: [note: any] }>()
const open = defineModel<boolean>({ default: false })

const toast = useToast()
const billing = useBillingPlatform({ base: props.endpoint })
const form = reactive<CreditNoteForm>({ target: 'invoice', amount: '', reason: '', invoice_id: '', tenant_key: '' })
const candidates = ref<Invoice[]>([])

watch(open, async (v) => {
  if (!v) return
  Object.assign(form, { target: 'invoice', amount: '', reason: '', invoice_id: props.invoice?.id ?? '', tenant_key: props.spaces[0]?.value ?? '' })
  if (props.invoice) { candidates.value = [props.invoice]; return }
  try {
    candidates.value = await billing.openInvoices({ client_id: props.clientId })
    form.invoice_id = candidates.value[0]?.id ?? ''
  } catch {
    candidates.value = []
  }
})

const targets = computed(() => props.invoice ? CREDIT_NOTE_TARGETS.filter(t => t.value === 'invoice') : CREDIT_NOTE_TARGETS)
const hint = computed(() => CREDIT_NOTE_TARGETS.find(t => t.value === form.target)?.hint)

async function submit() {
  const { payload, error } = creditNotePayload(form, props.clientId)
  if (error) { toast.error(error); return }
  try {
    const note = await billing.createCreditNote.mutateAsync(payload)
    open.value = false
    toast.success(`Nota de crédito ${note?.display_number ?? ''} creada.`)
    emit('created', note)
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo crear la nota de crédito.'))
  }
}

const inputClass = 'w-full h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
</script>

<template>
  <Modal v-model="open" title="Nota de crédito" size="md" show-footer>
    <div class="space-y-3 text-sm">
      <label class="block space-y-1"><span class="font-medium">Se aplica a</span>
        <select v-model="form.target" :class="inputClass"><option v-for="t in targets" :key="t.value" :value="t.value">{{ t.label }}</option></select>
        <span class="text-xs text-muted-foreground">{{ hint }}</span>
      </label>
      <label v-if="form.target === 'invoice'" class="block space-y-1"><span class="font-medium">Factura</span>
        <select v-model="form.invoice_id" :class="inputClass" :disabled="!!invoice">
          <option v-if="!candidates.length" value="">No hay facturas abiertas</option>
          <option v-for="i in candidates" :key="i.id" :value="i.id">{{ i.display_number }} · saldo {{ formatMoney(i.balance, i.currency) }}</option>
        </select>
      </label>
      <label v-if="form.target === 'next_period'" class="block space-y-1"><span class="font-medium">Espacio</span>
        <select v-model="form.tenant_key" :class="inputClass"><option v-for="s in spaces" :key="s.value" :value="s.value">{{ s.label }}</option></select>
      </label>
      <label class="block space-y-1"><span class="font-medium">Monto ($)</span><input v-model="form.amount" inputmode="numeric" :class="inputClass" /></label>
      <label class="block space-y-1"><span class="font-medium">Motivo</span><input v-model="form.reason" :class="inputClass" maxlength="250" /></label>
    </div>
    <template #footer>
      <App.Button text="Cancelar" size="sm" @click="open = false" />
      <App.Button text="Crear nota de crédito" severity="primary" size="sm" :loading="billing.createCreditNote.isPending.value" @click="submit" />
    </template>
  </Modal>
</template>
