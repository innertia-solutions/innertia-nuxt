<script setup lang="ts">
import { errorMessage, parseReminderDays } from '../../composables/useBilling/internal/billing'

/*
 * Billing.Settings — platform billing settings (owner): USD→CLP rate used to value AI cost, transfer
 * instructions shown in the invoice email/PDF and the issuer block of the PDF; plus manual runs of
 * the daily close, dunning and payment reminders (they also run on the scheduler, America/Santiago).
 * Reminders: days before the due date, the due day, every N days while overdue (max), escalation (copy to
 * the collections email + critical notice) after N overdue reminders.
 * Backend: GET|PUT {endpoint}/settings, POST {endpoint}/run/{close|dunning|reminders}.
 */
const props = withDefaults(defineProps<{ endpoint?: string; canRun?: boolean }>(), { endpoint: 'platform/billing', canRun: true })

const toast = useToast()
const { confirm } = useModal()
const { settings, saveSettings, run } = useBillingPlatform({ base: props.endpoint })
const form = reactive({
  usd_clp_rate: '' as string | number, transfer_instructions: '', issuer_name: '', issuer_tax_id: '', issuer_address: '',
  reminders_enabled: true, reminder_days_before: '3', reminder_on_due: true, reminder_overdue_every_days: 7 as number | string,
  reminder_overdue_max: 6 as number | string, reminder_escalate_after: 2 as number | string, reminder_escalation_email: '',
})

watch(() => settings.data.value, (s: any) => {
  if (s) {
    Object.assign(form, {
      usd_clp_rate: s.usd_clp_rate ?? '', transfer_instructions: s.transfer_instructions ?? '', issuer_name: s.issuer_name ?? '', issuer_tax_id: s.issuer_tax_id ?? '', issuer_address: s.issuer_address ?? '',
      reminders_enabled: s.reminders_enabled ?? true, reminder_days_before: s.reminder_days_before ?? '', reminder_on_due: s.reminder_on_due ?? true,
      reminder_overdue_every_days: s.reminder_overdue_every_days ?? 7, reminder_overdue_max: s.reminder_overdue_max ?? 6,
      reminder_escalate_after: s.reminder_escalate_after ?? 2, reminder_escalation_email: s.reminder_escalation_email ?? '',
    })
  }
}, { immediate: true })

async function save() {
  const days = parseReminderDays(form.reminder_days_before)
  if (days === null) { toast.error('Días antes del vencimiento: números separados por coma (ej. 7, 3).'); return }
  try {
    await saveSettings.mutateAsync({
      usd_clp_rate: form.usd_clp_rate === '' ? null : Number(form.usd_clp_rate),
      transfer_instructions: form.transfer_instructions || null,
      issuer_name: form.issuer_name || null, issuer_tax_id: form.issuer_tax_id || null, issuer_address: form.issuer_address || null,
      reminders_enabled: form.reminders_enabled, reminder_days_before: days.join(',') || null, reminder_on_due: form.reminder_on_due,
      reminder_overdue_every_days: Number(form.reminder_overdue_every_days) || 7, reminder_overdue_max: Number(form.reminder_overdue_max) || 0,
      reminder_escalate_after: Number(form.reminder_escalate_after) || 0, reminder_escalation_email: form.reminder_escalation_email || null,
    })
    toast.success('Configuración guardada.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo guardar.'))
  }
}

const JOBS = {
  close: ['Cerrar períodos ahora', 'Se cierran los períodos vencidos y se generan las facturas en borrador. Es idempotente: no duplica cobros.'],
  dunning: ['Revisar mora ahora', 'Se marcan las facturas vencidas y se actualiza el estado de las suscripciones (mora, suspensión, reactivación).'],
  reminders: ['Enviar recordatorios ahora', 'Se envían los recordatorios que correspondan hoy. Nunca repite uno ya enviado.'],
} as const

async function runJob(job: 'close' | 'dunning' | 'reminders') {
  const ok = await confirm({
    title: JOBS[job][0],
    message: JOBS[job][1],
    confirmText: 'Ejecutar',
  })
  if (!ok) return
  try {
    const res: any = await run.mutateAsync(job)
    toast.success(job === 'close' ? `Cierre listo: ${res?.statements ?? 0} cobros nuevos.`
      : job === 'dunning' ? `Mora revisada: ${res?.overdue ?? 0} facturas vencidas, ${res?.changed ?? 0} cambios.`
        : `Recordatorios: ${res?.sent ?? 0} enviados (${res?.escalated ?? 0} escalados).`)
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
      <p class="sm:col-span-2 font-medium text-foreground pt-2">Recordatorios de pago</p>
      <label class="sm:col-span-2 flex items-center gap-2"><input v-model="form.reminders_enabled" type="checkbox" class="rounded" /> Enviar recordatorios por correo (marca de la plataforma) y avisos a los administradores del espacio</label>
      <label class="block space-y-1"><span class="font-medium">Días antes del vencimiento</span><input v-model="form.reminder_days_before" :class="inputClass" placeholder="7, 3" /></label>
      <label class="flex items-center gap-2 self-end h-9"><input v-model="form.reminder_on_due" type="checkbox" class="rounded" /> El día que vence</label>
      <label class="block space-y-1"><span class="font-medium">Vencida: cada cuántos días</span><input v-model="form.reminder_overdue_every_days" type="number" min="1" max="90" :class="inputClass" /></label>
      <label class="block space-y-1"><span class="font-medium">Máximo de recordatorios de vencida</span><input v-model="form.reminder_overdue_max" type="number" min="0" max="50" :class="inputClass" /></label>
      <label class="block space-y-1"><span class="font-medium">Escalar después de (recordatorios de vencida)</span><input v-model="form.reminder_escalate_after" type="number" min="0" max="50" :class="inputClass" /></label>
      <label class="block space-y-1"><span class="font-medium">Correo de cobranza (copia al escalar)</span><input v-model="form.reminder_escalation_email" type="email" :class="inputClass" maxlength="150" /></label>
      <div class="sm:col-span-2 flex justify-end">
        <App.Button text="Guardar" severity="primary" size="sm" :loading="saveSettings.isPending.value" @click="save" />
      </div>
    </form>

    <div v-if="canRun" class="bg-card border border-card-line rounded-card p-4 flex flex-wrap items-center gap-3 text-sm">
      <p class="flex-1 text-muted-foreground">El cierre (00:30), la revisión de mora (08:00) y los recordatorios (09:00) corren solos cada día, hora de Chile.</p>
      <App.Button text="Cerrar períodos" size="sm" :loading="run.isPending.value" @click="runJob('close')" />
      <App.Button text="Revisar mora" size="sm" :loading="run.isPending.value" @click="runJob('dunning')" />
      <App.Button text="Enviar recordatorios" size="sm" :loading="run.isPending.value" @click="runJob('reminders')" />
    </div>
  </div>
</template>
