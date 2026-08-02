<script setup>
const api = useApi()

const { data, pending, error } = await useAsyncData(
  'observability-database',
  () => api.get('platform/observability/database'),
)

function fmtBytes(bytes) {
  if (bytes == null) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = Number(bytes), i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(1)} ${units[i]}`
}
</script>

<template>
  <div>
    <div v-if="pending" class="text-sm text-muted-foreground">Cargando…</div>
    <div v-else-if="error" class="text-sm text-red-500">No se pudo cargar la capacidad de la BD.</div>
    <div v-else class="space-y-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-card border border-border p-4">
          <p class="text-xs text-muted-foreground">Tamaño de la BD</p>
          <p class="mt-1 text-lg font-bold text-foreground">{{ fmtBytes(data.capacity?.database_bytes) }}</p>
        </div>
        <div class="rounded-card border border-border p-4">
          <p class="text-xs text-muted-foreground">Conexiones</p>
          <p class="mt-1 text-lg font-bold text-foreground">
            {{ data.capacity?.connections?.used ?? '—' }} / {{ data.capacity?.connections?.max ?? '—' }}
          </p>
        </div>
        <div class="rounded-card border border-border p-4">
          <p class="text-xs text-muted-foreground">Disco usado</p>
          <p class="mt-1 text-lg font-bold text-foreground">{{ data.disk?.percent != null ? data.disk.percent + '%' : '—' }}</p>
        </div>
      </div>

      <div>
        <h2 class="mb-2 text-sm font-semibold text-foreground">Tablas más grandes</h2>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-muted-foreground">
              <th class="py-1">Tabla</th><th class="py-1">Tamaño</th><th class="py-1">Filas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in data.capacity?.tables ?? []" :key="t.name" class="border-t border-border">
              <td class="py-1">{{ t.name }}</td>
              <td class="py-1">{{ fmtBytes(t.bytes) }}</td>
              <td class="py-1">{{ Number(t.rows).toLocaleString('es-CL') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
