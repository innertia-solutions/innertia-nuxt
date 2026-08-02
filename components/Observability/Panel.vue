<script setup>
// Panel drop-in de observabilidad. Overview es la landing; luego BD, Errores, Logs, Archivos.
// Realtime: UNA sola suscripción al canal 'observability' acá (useRealtime es singleton
// por canal; suscribir en cada tab se pisaría el handler). Al recibir case.touched se
// bumpea `touchedAt` y los tabs (Overview/Errores) reaccionan por prop.
const rt = useRealtime()
const touchedAt = ref(0)

const TABS = [
  { key: 'overview', label: 'Resumen' },
  { key: 'database', label: 'Base de datos' },
  { key: 'errors',   label: 'Errores' },
  { key: 'logs',     label: 'Logs' },
  { key: 'files',    label: 'Archivos' },
]
const active = ref('overview')

onMounted(async () => {
  try { await rt.connect(); rt.subscribe('observability', { 'case.touched': () => { touchedAt.value = Date.now() } }) } catch {}
})
onBeforeUnmount(() => rt.unsubscribe('observability'))
</script>

<template>
  <div class="space-y-5">
    <nav class="flex gap-1 border-b border-card-line overflow-x-auto">
      <button v-for="t in TABS" :key="t.key" type="button" @click="active = t.key"
        class="px-3 py-2 text-sm font-medium transition-colors -mb-px border-b-2 whitespace-nowrap"
        :class="active === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'">
        {{ t.label }}
      </button>
    </nav>

    <div v-show="active === 'overview'"><Observability.Overview :touched-at="touchedAt" /></div>
    <div v-show="active === 'database'"><Observability.Dashboard /></div>
    <div v-show="active === 'errors'"><Observability.Errors :touched-at="touchedAt" /></div>
    <div v-show="active === 'logs'"><Observability.Logs channel="operational" /></div>
    <div v-show="active === 'files'">
      <p class="rounded-card border border-dashed border-card-line p-8 text-center text-sm text-muted-foreground">
        Visor de archivos de log — próximamente (Fase 4).
      </p>
    </div>
  </div>
</template>
