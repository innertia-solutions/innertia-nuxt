<script setup>
const props = defineProps({
  channel: { type: String, default: 'operational' },
})

const endpoint = computed(() => `platform/observability/logs?channel=${props.channel}`)

const columns = [
  { key: 'occurred_at', label: 'Fecha', sortable: true },
  { key: 'level',       label: 'Nivel' },
  { key: 'message',     label: 'Mensaje' },
]

const levelOf   = (row) => row?.payload?.level ?? '—'
const messageOf = (row) => row?.payload?.message ?? '—'
</script>

<template>
  <Table.Standard
    :name="`observability-logs-${channel}`"
    :endpoint="endpoint"
    :columns="columns"
    search-placeholder="Buscar en logs…"
  >
    <template #level="{ row }">{{ levelOf(row) }}</template>
    <template #message="{ row }">{{ messageOf(row) }}</template>
  </Table.Standard>
</template>
