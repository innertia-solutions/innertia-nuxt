<script setup>
// Detalle de un caso de error (Sentry-like): header + criticidad, timeline de
// ocurrencias, stack trace, contexto del request y traces de muestra.
const props = defineProps({
  id: { type: [String, Number], required: true },
})
const emit = defineEmits(['back'])
const api = useApi()

const { data, pending } = await useAsyncData(
  () => `obs-error-${props.id}`,
  () => api.get(`platform/observability/errors/${props.id}`),
  { watch: [() => props.id] },
)

const exceptionEvent = computed(() => (data.value?.events ?? []).find(e => e.type === 'exception'))
const stackFrames = computed(() => exceptionEvent.value?.payload?.stack ?? exceptionEvent.value?.payload?.frames ?? [])

const timelineSeries = computed(() => [{ name: 'Ocurrencias', data: (data.value?.timeline ?? []).map(d => d.count) }])
const timelineCats = computed(() => (data.value?.timeline ?? []).map(d => d.day))

const STATUS = { open: 'Abierto', resolved: 'Resuelto', ignored: 'Ignorado' }
</script>

<template>
  <div class="space-y-5">
    <button type="button" class="text-sm text-primary hover:underline" @click="emit('back')">← Volver a errores</button>

    <div v-if="pending" class="py-10 text-center text-sm text-muted-foreground">Cargando…</div>

    <template v-else-if="data">
      <div class="rounded-card border border-card-line bg-card p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="data.is_critical" class="rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 px-2 py-0.5 text-xs font-semibold">Crítico</span>
          <span class="rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 text-xs">{{ STATUS[data.case.status] ?? data.case.status }}</span>
          <span class="text-xs text-muted-foreground">{{ data.case.times_seen }} ocurrencias</span>
        </div>
        <h2 class="mt-2 text-lg font-semibold text-foreground">{{ data.case.title }}</h2>
        <p class="text-sm text-muted-foreground font-mono">{{ data.case.exception_class }}</p>
        <p class="mt-1 text-xs text-muted-foreground">Primera vez: {{ data.case.first_seen }} · Última: {{ data.case.last_seen }}</p>
      </div>

      <section v-if="timelineCats.length">
        <h3 class="mb-2 text-sm font-semibold text-foreground">Ocurrencias (30 días)</h3>
        <Chart type="bar" :series="timelineSeries" :categories="timelineCats" :height="160" />
      </section>

      <section v-if="data.trace" class="rounded-card border border-card-line bg-card p-4 text-sm">
        <h3 class="mb-2 text-sm font-semibold text-foreground">Contexto del request</h3>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div><dt class="text-muted-foreground inline">Ruta:</dt> <dd class="inline text-foreground">{{ data.trace.method }} {{ data.trace.route ?? data.trace.url }}</dd></div>
          <div><dt class="text-muted-foreground inline">Status:</dt> <dd class="inline text-foreground">{{ data.trace.status ?? '—' }}</dd></div>
          <div><dt class="text-muted-foreground inline">Usuario:</dt> <dd class="inline text-foreground">{{ data.trace.user_id ?? '—' }}</dd></div>
          <div><dt class="text-muted-foreground inline">Tenant:</dt> <dd class="inline text-foreground">{{ data.trace.tenant ?? '—' }}</dd></div>
          <div><dt class="text-muted-foreground inline">IP:</dt> <dd class="inline text-foreground">{{ data.trace.ip ?? '—' }}</dd></div>
          <div><dt class="text-muted-foreground inline">Duración:</dt> <dd class="inline text-foreground">{{ data.trace.duration_ms != null ? data.trace.duration_ms + ' ms' : '—' }}</dd></div>
        </dl>
      </section>

      <section v-if="stackFrames.length">
        <h3 class="mb-2 text-sm font-semibold text-foreground">Stack trace</h3>
        <ol class="rounded-card border border-card-line bg-card divide-y divide-card-line text-xs font-mono">
          <li v-for="(f, i) in stackFrames" :key="i" class="px-3 py-1.5">
            <span class="text-foreground">{{ f.function ?? f.call ?? '' }}</span>
            <span class="text-muted-foreground"> — {{ f.file ?? '' }}<span v-if="f.line">:{{ f.line }}</span></span>
          </li>
        </ol>
      </section>
      <section v-else-if="exceptionEvent">
        <h3 class="mb-2 text-sm font-semibold text-foreground">Excepción</h3>
        <pre class="rounded-card border border-card-line bg-card p-3 text-xs whitespace-pre-wrap">{{ exceptionEvent.payload?.message ?? data.case.title }}</pre>
      </section>

      <section v-if="data.samples?.length">
        <h3 class="mb-2 text-sm font-semibold text-foreground">Ocurrencias de muestra</h3>
        <ul class="text-xs text-muted-foreground space-y-1">
          <li v-for="s in data.samples" :key="s.trace_id">{{ s.occurred_at }} · {{ s.method }} {{ s.route ?? s.url }} · {{ s.status ?? '—' }}</li>
        </ul>
      </section>
    </template>
  </div>
</template>
