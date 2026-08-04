<script setup>
// Colas & workers (v1): profundidad de cola + gestión de failed_jobs
// (reintentar/borrar por job + masivas). Refresca cada ~15s.
const api = useApi()
const toast = useToast()
const { confirm } = useModal()
const qc = useQueryClient()
const REFETCH = 15_000

const overview = useQuery({ queryKey: ['obs-queues', 'overview'], queryFn: () => api.get('platform/observability/queues/overview'), refetchInterval: REFETCH })
const failed   = useQuery({ queryKey: ['obs-queues', 'failed'],   queryFn: () => api.get('platform/observability/queues/failed'),   refetchInterval: REFETCH })

function reload() { qc.invalidateQueries({ queryKey: ['obs-queues'] }) }

async function retry(id) {
  try { await api.post(`platform/observability/queues/failed/${id}/retry`); toast.success('Job reintentado.'); reload() }
  catch { toast.error('No se pudo reintentar.') }
}
async function remove(id) {
  if (! await confirm({ severity: 'danger', title: 'Borrar job fallido', message: '¿Eliminar este job fallido?', confirmText: 'Borrar' })) return
  try { await api.delete(`platform/observability/queues/failed/${id}`); toast.success('Borrado.'); reload() }
  catch { toast.error('No se pudo borrar.') }
}
async function retryAll() {
  if (! await confirm({ title: 'Reintentar todos', message: '¿Reintentar todos los jobs fallidos?', confirmText: 'Reintentar' })) return
  try { await api.post('platform/observability/queues/failed/retry-all'); toast.success('Reintentados.'); reload() }
  catch { toast.error('Error al reintentar.') }
}
async function flush() {
  if (! await confirm({ severity: 'danger', title: 'Vaciar fallidos', message: '¿Eliminar TODOS los jobs fallidos? No se puede deshacer.', confirmText: 'Vaciar' })) return
  try { await api.post('platform/observability/queues/failed/flush'); toast.success('Vaciado.'); reload() }
  catch { toast.error('Error al vaciar.') }
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <Observability.MetricCard label="Pendientes" :value="overview.data.value?.depth?.total ?? '—'"
        :sublabel="`${overview.data.value?.depth?.queues?.length ?? 0} colas`" />
      <Observability.MetricCard label="Fallidos" :value="overview.data.value?.failed ?? 0"
        :tone="(overview.data.value?.failed ?? 0) > 0 ? 'bad' : 'good'" />
      <Observability.MetricCard label="Driver de cola" :value="overview.data.value?.depth?.driver ?? '—'" />
    </div>

    <section>
      <h3 class="mb-2 text-sm font-semibold text-foreground">Profundidad por cola</h3>
      <div v-if="overview.data.value?.depth && !overview.data.value.depth.available"
        class="rounded-card border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
        {{ overview.data.value.depth.reason }}
      </div>
      <table v-else class="w-full text-sm">
        <thead><tr class="text-left text-muted-foreground"><th class="py-1">Cola</th><th class="py-1">Pendientes</th></tr></thead>
        <tbody>
          <tr v-for="q in overview.data.value?.depth?.queues ?? []" :key="q.queue" class="border-t border-card-line">
            <td class="py-1 font-mono text-xs">{{ q.queue }}</td><td class="py-1">{{ q.count }}</td>
          </tr>
          <tr v-if="!(overview.data.value?.depth?.queues?.length)"><td colspan="2" class="py-2 text-xs text-muted-foreground">Sin pendientes 🎉</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <div class="mb-2 flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-foreground">Jobs fallidos</h3>
        <div v-if="failed.data.value?.jobs?.length" class="flex gap-2">
          <button class="text-xs text-primary hover:underline" @click="retryAll">Reintentar todos</button>
          <button class="text-xs text-red-500 hover:underline" @click="flush">Vaciar</button>
        </div>
      </div>
      <table class="w-full text-sm">
        <thead><tr class="text-left text-muted-foreground">
          <th class="py-1 pr-4">Job</th><th class="py-1 pr-4">Cola</th><th class="py-1 pr-4">Excepción</th><th class="py-1 pr-4">Fecha</th><th class="py-1"></th>
        </tr></thead>
        <tbody>
          <tr v-for="j in failed.data.value?.jobs ?? []" :key="j.id" class="border-t border-card-line align-top">
            <td class="py-1 pr-4 font-mono text-xs">{{ j.name }}</td>
            <td class="py-1 pr-4 text-xs">{{ j.queue }}</td>
            <td class="py-1 pr-4 text-xs text-muted-foreground truncate max-w-sm">{{ j.exception }}</td>
            <td class="py-1 pr-4 text-xs whitespace-nowrap">{{ j.failed_at }}</td>
            <td class="py-1 whitespace-nowrap">
              <button class="text-xs text-primary hover:underline mr-2" @click="retry(j.id)">Reintentar</button>
              <button class="text-xs text-red-500 hover:underline" @click="remove(j.id)">Borrar</button>
            </td>
          </tr>
          <tr v-if="!(failed.data.value?.jobs?.length)"><td colspan="5" class="py-2 text-xs text-muted-foreground">Sin jobs fallidos 🎉</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
