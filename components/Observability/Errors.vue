<script setup>
// Lista de errores (casos) con filtros + criticidad + entrar al detalle.
// Realtime: el Panel cambia `touchedAt` al recibir case.touched → recarga la tabla
// (bump de :key). La suscripción vive en el Panel (useRealtime es singleton por canal).
const props = defineProps({ touchedAt: { type: Number, default: 0 } })
const api = useApi()
const toast = useToast()

const selectedId = ref(null)
const reloadKey = ref(0)

const columns = [
  { key: 'last_seen',       label: 'Última vez', sortable: true },
  { key: 'title',           label: 'Error' },
  { key: 'exception_class', label: 'Clase' },
  { key: 'times_seen',      label: 'Veces', sortable: true },
  { key: 'origin', label: 'Origen', filterable: true, filterType: 'select',
    filterOptions: [
      { value: 'http', label: 'HTTP' }, { value: 'queue', label: 'Worker' },
      { value: 'schedule', label: 'Cron' }, { value: 'console', label: 'Consola' },
    ] },
  { key: 'category', label: 'Tipo', filterable: true, filterType: 'select',
    filterOptions: [
      { value: 'database', label: 'Base de datos' }, { value: 'http', label: 'HTTP' },
      { value: 'auth', label: 'Auth' }, { value: 'validation', label: 'Validación' },
      { value: 'runtime', label: 'Runtime' },
    ] },
  { key: 'status',          label: 'Estado', filterable: true, filterType: 'select',
    filterOptions: [
      { value: 'open', label: 'Abierto' },
      { value: 'resolved', label: 'Resuelto' },
      { value: 'ignored', label: 'Ignorado' },
    ] },
  { key: 'actions',         label: '' },
]

const statusLabels = { open: 'Abierto', resolved: 'Resuelto', ignored: 'Ignorado' }

async function setStatus(row, status) {
  try {
    await api.post(`platform/observability/errors/${row.id}/status`, { status })
    toast.success('Estado actualizado.')
    reloadKey.value++
  } catch (e) {
    toast.error(e?.data?.message ?? 'No se pudo cambiar el estado.')
  }
}

watch(() => props.touchedAt, () => { reloadKey.value++ })
</script>

<template>
  <div>
    <Observability.ErrorDetail v-if="selectedId" :id="selectedId" @back="selectedId = null" />

    <Table.Standard
      v-else
      :key="reloadKey"
      name="observability-errors"
      endpoint="platform/observability/errors"
      :columns="columns"
      search-placeholder="Buscar error…"
      @row-click="(row) => selectedId = row.id"
    >
      <template #title="{ row }">
        <div class="flex items-center gap-2">
          <span v-if="row.is_critical" class="inline-block size-2 rounded-full bg-red-500" title="Crítico" />
          <span class="text-foreground">{{ row.title }}</span>
        </div>
      </template>
      <template #origin="{ value }">
        <span class="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">{{ ({http:'HTTP',queue:'Worker',schedule:'Cron',console:'Consola'})[value] ?? value ?? '—' }}</span>
      </template>
      <template #category="{ value }">
        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
          :class="value === 'database' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : value === 'auth' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'">
          {{ ({database:'BD',http:'HTTP',auth:'Auth',validation:'Validación',runtime:'Runtime'})[value] ?? value ?? '—' }}
        </span>
      </template>
      <template #status="{ value }">{{ statusLabels[value] ?? value }}</template>
      <template #actions="{ row }">
        <div class="flex gap-2">
          <button class="text-xs text-muted-foreground hover:text-foreground" @click.stop="setStatus(row, 'resolved')">Resolver</button>
          <button class="text-xs text-muted-foreground hover:text-foreground" @click.stop="setStatus(row, 'ignored')">Ignorar</button>
        </div>
      </template>
    </Table.Standard>
  </div>
</template>
