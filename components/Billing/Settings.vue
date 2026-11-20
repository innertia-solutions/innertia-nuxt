<script setup lang="ts">
import { errorMessage } from '../../composables/useBilling/internal/billing'

/*
 * Billing.Settings — platform billing settings (owner): USD→CLP rate used to value AI cost, transfer
 * instructions shown in the invoice email/PDF and the issuer block of the PDF; plus manual runs of
 * the daily close and dunning (they also run on the scheduler, America/Santiago).
 * Backend: GET|PUT {endpoint}/settings, POST {endpoint}/run/{close|dunning}.
 */
const props = withDefaults(defineProps<{ endpoint?: string; canRun?: boolean }>(), { endpoint: 'platform/billing', canRun: true })

const toast = useToast()
const { confirm } = useModal()
const { settings, saveSettings, run } = useBillingPlatform({ base: props.endpoint })
const form = reactive({ usd_clp_rate: '' as string | number, transfer_instructions: '', issuer_name: '', issuer_tax_id: '', issuer_address: '' })

watch(() => settings.data.value, (s: any) => {
  if (s) Object.assign(form, { usd_clp_rate: s.usd_clp_rate ?? '', transfer_instructions: s.transfer_instructions ?? '', issuer_name: s.issuer_name ?? '', issuer_tax_id: s.issuer_tax_id ?? '', issuer_address: s.issuer_address ?? '' })
}, { immediate: true })

async function save() {
  try {
    await saveSettings.mutateAsync({
      usd_clp_rate: form.usd_clp_rate === '' ? null : Number(form.usd_clp_rate),
      transfer_instructions: form.transfer_instructions || null,
      issuer_name: form.issuer_name || null, issuer_tax_id: form.issuer_tax_id || null, issuer_address: form.issuer_address || null,
    })
    toast.success('Configuración guardada.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo guardar.'))
  }
}

async function runJob(job: 'close' | 'dunning') {
  const ok = await confirm({
    title: job === 'close' ? 'Cerrar períodos ahora' : 'Revisar mora ahora',
    message: job === 'close'
      ? 'Se cierran los períodos vencidos y se generan las facturas en borrador. Es idempotente: no duplica cobros.'
      : 'Se marcan las facturas vencidas y se actualiza el estado de las suscripciones (mora, suspensión, reactivación).',
    confirmText: 'Ejecutar',
  })
  if (!ok) return
  try {
    const res: any = await run.mutateAsync(job)
    toast.success(job === 'close' ? `Cierre listo: ${res?.statements ?? 0} cobros nuevos.` : `Mora revisada: ${res?.overdue ?? 0} facturas vencidas, ${res?.changed ?? 0} cambios.`)
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo ejecutar.'))
  }
}

const inputClass = 'w-full h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
</script>

<template>
  <div class="space-y-4">
    <form class="bg-card border border-card-line rounded-card p-4 grid gap-3 sm:grid-cols-2 text-sm" @submit.prevent="save">
      <label class="block space-y-1"><span class="font-medium">Tipo de cambio USD → CLP</span>
        <input v-model="form.usd_clp_rate" type="number" min="1" step="0.01" :class="inputClass" />
        <span class="text-xs text-muted-foreground">Valoriza el costo de IA de cada uso desde ahora.</span>
      </label>
      <span />
      <label class="block space-y-1"><span class="font-medium">Emisor (razón social)</span><input v-model="form.issuer_name" :class="inputClass" maxlength="150" /></label>
      <label class="block space-y-1"><span class="font-medium">RUT del emisor</span><input v-model="form.issuer_tax_id" :class="inputClass" maxlength="20" /></label>
      <label class="block space-y-1 sm:col-span-2"><span class="font-medium">Dirección del emisor</span><input v-model="form.issuer_address" :class="inputClass" maxlength="250" /></label>
      <label class="block space-y-1 sm:col-span-2"><span class="font-medium">Datos para transferencia</span>
        <textarea v-model="form.transfer_instructions" rows="3" maxlength="1000" class="w-full rounded-control border border-card-line bg-card text-sm text-foreground px-3 py-2" placeholder="Banco, tipo y número de cuenta, RUT, correo de aviso" />
      </label>
      <div class="sm:col-span-2 flex justify-end">
        <App.Button text="Guardar" severity="primary" size="sm" :loading="saveSettings.isPending.value" @click="save" />
      </div>
    </form>

    <div v-if="canRun" class="bg-card border border-card-line rounded-card p-4 flex flex-wrap items-center gap-3 text-sm">
      <p class="flex-1 text-muted-foreground">El cierre (00:30) y la revisión de mora (08:00) corren solos cada día, hora de Chile.</p>
      <App.Button text="Cerrar períodos" size="sm" :loading="run.isPending.value" @click="runJob('close')" />
      <App.Button text="Revisar mora" size="sm" :loading="run.isPending.value" @click="runJob('dunning')" />
    </div>
  </div>
</template>
