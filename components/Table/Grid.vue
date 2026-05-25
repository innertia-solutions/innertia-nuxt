<script setup>
import { IconSearch } from '@tabler/icons-vue'

// Grid / card layout view — wraps DataTable with viewMode="grid"
const props = defineProps({
  endpoint: { type: String, required: true },
  columns: { type: Array, required: true },
  name: { type: String, required: true },
  params: { type: Object, default: () => ({}) },
  cached: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: 'Buscar...' },
  showSearch: { type: Boolean, default: true },
  gridClass: { type: String, default: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
  clickRowToOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['row-click', 'loaded'])

const search = ref('')
const tableRef = ref(null)

const reload = () => tableRef.value?.reload()
const clearCache = () => tableRef.value?.clearCache()

defineExpose({ reload, clearCache })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="showSearch" class="relative">
      <div class="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none">
        <IconSearch class="size-4 text-muted-foreground" stroke="1.5" />
      </div>
      <input
        v-model="search"
        type="text"
        :placeholder="searchPlaceholder"
        class="innertia-field pe-10"
      />
    </div>

    <DataTable
      ref="tableRef"
      :endpoint="endpoint"
      :columns="columns"
      :name="name"
      :params="params"
      :search="search"
      :cached="cached"
      :click-row-to-open="clickRowToOpen"
      view-mode="grid"
      :grid-class="gridClass"
      @row-click="emit('row-click', $event)"
      @loaded="emit('loaded', $event)"
    >
      <!-- Card slot: pass through for custom card rendering -->
      <template v-if="$slots.card" #card="slotProps">
        <slot name="card" v-bind="slotProps" />
      </template>
    </DataTable>
  </div>
</template>
