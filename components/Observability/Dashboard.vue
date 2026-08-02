<script setup>
// Dashboard de base de datos con valor: gauges (cache hit, conexiones), cards
// (deadlocks, rollbacks), y tablas (queries lentas, índices sin usar, tablas con
// más dead tuples). Cada sección pide su endpoint (lazy) y refresca cada ~10s.
const api = useApi()
const REFETCH = 10_000

const overview    = useQuery({ queryKey: ['obs-db', 'overview'],    queryFn: () => api.get('platform/observability/database/overview'),    refetchInterval: REFETCH })
const connections = useQuery({ queryKey: ['obs-db', 'connections'], queryFn: () => api.get('platform/observability/database/connections'), refetchInterval: REFETCH })
const queries     = useQuery({ queryKey: ['obs-db', 'queries'],     queryFn: () => api.get('platform/observability/database/queries'),     refetchInterval: REFETCH })
const indexes     = useQuery({ queryKey: ['obs-db', 'indexes'],     queryFn: () => api.get('platform/observability/database/indexes'),     refetchInterval: REFETCH })
const tables      = useQuery({ queryKey: ['obs-db', 'tables'],      queryFn: () => api.get('platform/observability/database/tables'),      refetchInterval: REFETCH })

const connPercent = computed(() => {
  const d = connections.data.value
  if (!d || d.total == null || !d.max) return null
  return Math.round((d.total / d.max) * 100)
})

function fmtBytes(bytes) {
  if (bytes == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let n = Number(bytes), i = 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(1)} ${u[i]}`
}
function fmtMs(ms) { return ms == null ? '—' : `${Number(ms).toLocaleString('es-CL')} ms` }
</script>

<template>
  <div class="space-y-6">
    <!-- Gauges + cards de salud -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Observability.Gauge label="Cache hit" :percent="overview.data.value?.cache_hit_ratio ?? null" />
      <Observability.Gauge label="Conexiones" :percent="connPercent" />
      <Observability.MetricCard label="Deadlocks" :value="overview.data.value?.deadlocks ?? '—'"
        :tone="(overview.data.value?.deadlocks ?? 0) > 0 ? 'bad' : 'good'" />
      <Observability.MetricCard label="Rollbacks" :value="overview.data.value?.rollbacks ?? '—'"
        :sublabel="`Tamaño BD: ${fmtBytes(overview.data.value?.database_bytes)}`" />
    </div>

    <!-- Conexiones por estado -->
    <div v-if="connections.data.value" class="flex flex-wrap gap-2">
      <span v-for="(n, state) in connections.data.value.by_state" :key="state"
        class="rounded-full border border-card-line bg-card px-2.5 py-1 text-xs text-muted-foreground">
        {{ state }}: <span class="font-semibold text-foreground">{{ n }}</span>
      </span>
      <span class="rounded-full border border-card-line bg-card px-2.5 py-1 text-xs text-muted-foreground">
        total: <span class="font-semibold text-foreground">{{ connections.data.value.total }}</span> / {{ connections.data.value.max ?? '—' }}
      </span>
    </div>

    <!-- Queries lentas -->
    <section>
      <h3 class="mb-2 text-sm font-semibold text-foreground">Queries más lentas</h3>
      <div v-if="queries.data.value && !queries.data.value.available"
        class="rounded-card border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
        {{ queries.data.value.reason }}
      </div>
      <table v-else class="w-full text-sm">
        <thead><tr class="text-left text-muted-foreground">
          <th class="py-1">Query</th><th class="py-1">Llamadas</th><th class="py-1">Media</th><th class="py-1">Total</th>
        </tr></thead>
        <tbody>
          <tr v-for="q in queries.data.value?.top ?? []" :key="q.id" class="border-t border-card-line">
            <td class="py-1 font-mono text-xs">{{ q.query }}</td>
            <td class="py-1">{{ Number(q.calls).toLocaleString('es-CL') }}</td>
            <td class="py-1">{{ fmtMs(q.mean_ms) }}</td>
            <td class="py-1">{{ fmtMs(q.total_ms) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Índices sin usar + tablas con dead tuples -->
    <div class="grid gap-6 lg:grid-cols-2">
      <section>
        <h3 class="mb-2 text-sm font-semibold text-foreground">Índices sin usar</h3>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-muted-foreground"><th class="py-1">Índice</th><th class="py-1">Tabla</th><th class="py-1">Tamaño</th></tr></thead>
          <tbody>
            <tr v-for="ix in indexes.data.value?.unused ?? []" :key="ix.index" class="border-t border-card-line">
              <td class="py-1 font-mono text-xs">{{ ix.index }}</td><td class="py-1">{{ ix.table }}</td><td class="py-1">{{ fmtBytes(ix.bytes) }}</td>
            </tr>
            <tr v-if="!(indexes.data.value?.unused?.length)"><td colspan="3" class="py-2 text-xs text-muted-foreground">Sin índices sin usar 🎉</td></tr>
          </tbody>
        </table>
      </section>
      <section>
        <h3 class="mb-2 text-sm font-semibold text-foreground">Tablas con más dead tuples</h3>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-muted-foreground"><th class="py-1">Tabla</th><th class="py-1">Muertas</th><th class="py-1">Bloat</th><th class="py-1">Tamaño</th></tr></thead>
          <tbody>
            <tr v-for="t in tables.data.value?.tables ?? []" :key="t.name" class="border-t border-card-line">
              <td class="py-1">{{ t.name }}</td><td class="py-1">{{ Number(t.dead).toLocaleString('es-CL') }}</td>
              <td class="py-1">{{ t.bloat_pct }}%</td><td class="py-1">{{ fmtBytes(t.bytes) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>
