<script setup>
// Lista de errores (casos) con filtros + criticidad + entrar al detalle.
// Realtime: al recibir case.touched se refresca la tabla (bump de :key).
const api = useApi()
const toast = useToast()
const rt = useRealtime()

const selectedId = ref(null)
const reloadKey = ref(0)

const columns = [
  { key: 'last_seen',       label: 'Última vez', sortable: true },
  { key: 'title',           label: 'Error' },
  { key: 'exception_class', label: 'Clase' },
  { key: 'times_seen',      label: 'Veces', sortable: true },
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

onMounted(async () => {
  try { await rt.connect(); rt.subscribe('observability', { 'case.touched': () => { reloadKey.value++ } }) } catch {}
})
onBeforeUnmount(() => rt.unsubscribe('observability'))
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
