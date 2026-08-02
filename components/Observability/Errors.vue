<script setup>
const api = useApi()
const toast = useToast()
const reloadKey = ref(0)

const columns = [
  { key: 'last_seen',       label: 'Última vez', sortable: true },
  { key: 'title',           label: 'Error' },
  { key: 'exception_class', label: 'Clase' },
  { key: 'times_seen',      label: 'Veces' },
  { key: 'status',          label: 'Estado' },
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
</script>

<template>
  <Table.Standard
    :key="reloadKey"
    name="observability-errors"
    endpoint="platform/observability/errors"
    :columns="columns"
    search-placeholder="Buscar error…"
  >
    <template #status="{ value }">{{ statusLabels[value] ?? value }}</template>
    <template #actions="{ row }">
      <div class="flex gap-2">
        <button class="text-xs text-muted-foreground hover:text-foreground" @click="setStatus(row, 'resolved')">Resolver</button>
        <button class="text-xs text-muted-foreground hover:text-foreground" @click="setStatus(row, 'ignored')">Ignorar</button>
      </div>
    </template>
  </Table.Standard>
</template>
