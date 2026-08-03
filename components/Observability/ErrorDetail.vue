<script setup>
// Detalle de un caso de error (Sentry-like) desde el snapshot durable del caso:
// stack completo (in-app resaltado + código fuente), contexto del request,
// cadena de excepciones y breadcrumbs. Timeline de ocurrencias arriba.
const props = defineProps({ id: { type: [String, Number], required: true } })
const emit = defineEmits(['back'])
const api = useApi()

const { data, pending } = await useAsyncData(
  () => `obs-error-${props.id}`,
  () => api.get(`platform/observability/errors/${props.id}`),
  { watch: [() => props.id] },
)

const snap = computed(() => data.value?.snapshot ?? null)

const timelineSeries = computed(() => [{ name: 'Ocurrencias', data: (data.value?.timeline ?? []).map(d => d.count) }])
const timelineCats = computed(() => (data.value?.timeline ?? []).map(d => d.day))

const expanded = ref({})
function toggle(i) { expanded.value = { ...expanded.value, [i]: !expanded.value[i] } }

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
          <span v-if="data.case.origin" class="rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 text-xs">{{ ({http:'HTTP',queue:'Worker',schedule:'Cron',console:'Consola'})[data.case.origin] ?? data.case.origin }}</span>
          <span v-if="data.case.category" class="rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 px-2 py-0.5 text-xs">{{ ({database:'BD',http:'HTTP',auth:'Auth',validation:'Validación',runtime:'Runtime'})[data.case.category] ?? data.case.category }}</span>
          <span v-for="(v, k) in (data.case.tags ?? {})" :key="k" class="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">{{ k }}: {{ v }}</span>
          <span class="text-xs text-muted-foreground">{{ data.case.times_seen }} ocurrencias</span>
        </div>
        <h2 class="mt-2 text-lg font-semibold text-foreground">{{ data.case.title }}</h2>
        <p class="text-sm text-muted-foreground font-mono">{{ data.case.exception_class }}</p>
        <p v-if="snap?.message" class="mt-1 text-sm text-foreground">{{ snap.message }}</p>
        <p class="mt-1 text-xs text-muted-foreground">Primera vez: {{ data.case.first_seen }} · Última: {{ data.case.last_seen }}</p>
      </div>

      <section v-if="timelineCats.length">
        <h3 class="mb-2 text-sm font-semibold text-foreground">Ocurrencias (30 días)</h3>
        <Chart type="bar" :series="timelineSeries" :categories="timelineCats" :height="160" />
      </section>

      <div v-if="!snap" class="rounded-card border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
        Este caso no tiene snapshot (ocurrió antes de habilitarse la captura durable). Volverá a completarse la próxima vez que el error reincida.
      </div>

      <template v-else>
        <section v-if="snap.previous?.length">
          <h3 class="mb-2 text-sm font-semibold text-foreground">Causado por</h3>
          <ul class="space-y-1 text-xs">
            <li v-for="(p, i) in snap.previous" :key="i" class="rounded-card border border-card-line bg-card px-3 py-1.5">
              <span class="font-mono text-foreground">{{ p.class }}</span>
              <span class="text-muted-foreground"> — {{ p.message }} <span class="opacity-70">({{ p.file }}:{{ p.line }})</span></span>
            </li>
          </ul>
        </section>

        <section v-if="snap.request" class="rounded-card border border-card-line bg-card p-4 text-sm">
          <h3 class="mb-2 text-sm font-semibold text-foreground">Contexto del request</h3>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><dt class="text-muted-foreground inline">Ruta:</dt> <dd class="inline text-foreground">{{ snap.request.method }} {{ snap.request.route ?? snap.request.url }}</dd></div>
            <div><dt class="text-muted-foreground inline">Status:</dt> <dd class="inline text-foreground">{{ data.trace?.status ?? '—' }}</dd></div>
            <div><dt class="text-muted-foreground inline">Usuario:</dt> <dd class="inline text-foreground">{{ snap.request.user_id ?? '—' }}</dd></div>
            <div><dt class="text-muted-foreground inline">IP:</dt> <dd class="inline text-foreground">{{ snap.request.ip ?? '—' }}</dd></div>
            <div class="col-span-2"><dt class="text-muted-foreground inline">User-Agent:</dt> <dd class="inline text-foreground break-all">{{ snap.request.user_agent ?? '—' }}</dd></div>
          </dl>
          <details v-if="snap.request.query && Object.keys(snap.request.query).length" class="mt-2 text-xs">
            <summary class="cursor-pointer text-muted-foreground">Query params</summary>
            <pre class="mt-1 overflow-x-auto rounded bg-slate-50 dark:bg-slate-900/40 p-2 text-[11px]">{{ JSON.stringify(snap.request.query, null, 2) }}</pre>
          </details>
          <details v-if="snap.request.body && Object.keys(snap.request.body).length" class="mt-2 text-xs">
            <summary class="cursor-pointer text-muted-foreground">Body</summary>
            <pre class="mt-1 overflow-x-auto rounded bg-slate-50 dark:bg-slate-900/40 p-2 text-[11px]">{{ JSON.stringify(snap.request.body, null, 2) }}</pre>
          </details>
          <details v-if="snap.request.headers && Object.keys(snap.request.headers).length" class="mt-2 text-xs">
            <summary class="cursor-pointer text-muted-foreground">Headers</summary>
            <pre class="mt-1 overflow-x-auto rounded bg-slate-50 dark:bg-slate-900/40 p-2 text-[11px]">{{ JSON.stringify(snap.request.headers, null, 2) }}</pre>
          </details>
        </section>

        <section v-if="snap.stack?.length">
          <h3 class="mb-2 text-sm font-semibold text-foreground">Stack trace</h3>
          <div class="rounded-card border border-card-line bg-card divide-y divide-card-line overflow-hidden">
            <div v-for="(f, i) in snap.stack" :key="i" :class="f.in_app ? '' : 'opacity-60'">
              <button type="button" class="w-full flex items-baseline gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50" @click="toggle(i)">
                <span v-if="f.in_app" class="mt-0.5 inline-block size-1.5 rounded-full bg-primary shrink-0" title="in-app" />
                <span class="font-mono text-foreground">{{ f.function || '{main}' }}</span>
                <span class="font-mono text-muted-foreground ml-auto shrink-0">{{ f.file }}<span v-if="f.line">:{{ f.line }}</span></span>
              </button>
              <div v-if="f.context && (expanded[i] || f.in_app)" class="bg-slate-50 dark:bg-slate-900/40 overflow-x-auto">
                <pre class="text-[11px] leading-5 font-mono"><template v-for="ln in f.context" :key="ln.n"><div :class="ln.error ? 'bg-red-100 dark:bg-red-500/20' : ''" class="px-3"><span class="inline-block w-8 select-none text-muted-foreground text-right pr-2">{{ ln.n }}</span><span :class="ln.error ? 'text-red-700 dark:text-red-300' : 'text-foreground'">{{ ln.code }}</span></div></template></pre>
              </div>
            </div>
          </div>
        </section>

        <section v-if="snap.breadcrumbs?.length">
          <h3 class="mb-2 text-sm font-semibold text-foreground">Breadcrumbs (antes del error)</h3>
          <ul class="rounded-card border border-card-line bg-card divide-y divide-card-line text-xs">
            <li v-for="(b, i) in snap.breadcrumbs" :key="i" class="flex items-baseline gap-2 px-3 py-1.5">
              <span class="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground shrink-0">{{ b.type }}</span>
              <span class="font-mono text-foreground truncate">{{ b.summary }}</span>
              <span v-if="b.duration_ms != null" class="ml-auto text-muted-foreground shrink-0">{{ b.duration_ms }} ms</span>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>
