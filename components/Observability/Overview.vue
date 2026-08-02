<script setup>
// Overview pro: KPIs de errores (con criticidad), BD, slow queries y colas.
// Refresca cada ~15s y en vivo al recibir case.touched.
const api = useApi()
const rt = useRealtime()

const { data, refresh } = await useAsyncData('obs-overview', () => api.get('platform/observability/overview'))
const timer = ref(null)

onMounted(async () => {
  timer.value = setInterval(refresh, 15_000)
  try { await rt.connect(); rt.subscribe('observability', { 'case.touched': () => refresh() }) } catch {}
})
onBeforeUnmount(() => {
  if (timer.value) clearInterval(timer.value)
  rt.unsubscribe('observability')
})

function fmtBytes(b) {
  if (b == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let n = Number(b), i = 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(1)} ${u[i]}`
}
function fmtMs(ms) { return ms == null ? '—' : `${Number(ms).toLocaleString('es-CL')} ms` }
</script>

<template>
  <div v-if="data" class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Observability.MetricCard label="Errores abiertos" :value="data.errors.open"
        :tone="data.errors.open > 0 ? 'warn' : 'good'"
        :sublabel="`${data.errors.critical} críticos`" />
      <Observability.MetricCard label="Críticos" :value="data.errors.critical"
        :tone="data.errors.critical > 0 ? 'bad' : 'good'" />
      <Observability.MetricCard label="Cache hit"
        :value="data.database.cache_hit_ratio != null ? data.database.cache_hit_ratio + '%' : '—'"
        :tone="(data.database.cache_hit_ratio ?? 100) >= 95 ? 'good' : 'warn'"
        :sublabel="`BD: ${fmtBytes(data.database.database_bytes)}`" />
      <Observability.MetricCard label="Colas"
        :value="data.queue.pending ?? '—'"
        :tone="(data.queue.failed ?? 0) > 0 ? 'bad' : 'neutral'"
        :sublabel="`${data.queue.failed ?? 0} fallidos`" />
    </div>

    <div class="flex flex-wrap gap-2 text-xs">
      <span class="rounded-full border border-card-line bg-card px-2.5 py-1 text-muted-foreground">Resueltos: <span class="font-semibold text-foreground">{{ data.errors.resolved }}</span></span>
      <span class="rounded-full border border-card-line bg-card px-2.5 py-1 text-muted-foreground">Ignorados: <span class="font-semibold text-foreground">{{ data.errors.ignored }}</span></span>
      <span class="rounded-full border border-card-line bg-card px-2.5 py-1 text-muted-foreground">Errores 24h (log): <span class="font-semibold text-foreground">{{ data.logs?.errors_24h ?? 0 }}</span></span>
      <span class="rounded-full border border-card-line bg-card px-2.5 py-1 text-muted-foreground">Conexiones: <span class="font-semibold text-foreground">{{ data.database.connections.total ?? '—' }}/{{ data.database.connections.max ?? '—' }}</span></span>
    </div>

    <section>
      <h3 class="mb-2 text-sm font-semibold text-foreground">Top consultas lentas</h3>
      <table class="w-full text-sm">
        <thead><tr class="text-left text-muted-foreground">
          <th class="py-1 pr-4">Query</th>
          <th class="py-1 pr-4 whitespace-nowrap">Llamadas</th>
          <th class="py-1 pr-4 whitespace-nowrap">Media</th>
          <th class="py-1 whitespace-nowrap">Total</th>
        </tr></thead>
        <tbody>
          <tr v-for="q in data.slow_queries" :key="q.id" class="border-t border-card-line">
            <td class="py-1 pr-4 font-mono text-xs truncate max-w-md">{{ q.query }}</td>
            <td class="py-1 pr-4">{{ Number(q.calls).toLocaleString('es-CL') }}</td>
            <td class="py-1 pr-4">{{ fmtMs(q.mean_ms) }}</td>
            <td class="py-1">{{ fmtMs(q.total_ms) }}</td>
          </tr>
          <tr v-if="!data.slow_queries?.length"><td colspan="4" class="py-2 text-xs text-muted-foreground">Sin datos de consultas.</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
