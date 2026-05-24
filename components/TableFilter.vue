<script setup>
const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  columns:    { type: Array,  required: true },
})

const emit = defineEmits(['update:modelValue'])

const filterableColumns = computed(() => props.columns.filter(c => c.filterType))

const localFilters = ref({ ...props.modelValue })

watch(() => props.modelValue, (v) => {
  localFilters.value = { ...v }
}, { deep: true })

const updateFilter = (key, value) => {
  localFilters.value[key] = value || null
  emit('update:modelValue', { ...localFilters.value })
}

const clearAll = () => {
  localFilters.value = {}
  emit('update:modelValue', {})
}

const activeCount = computed(() =>
  Object.values(localFilters.value).filter(v => v !== null && v !== undefined && v !== '').length
)
</script>

<template>
  <div class="space-y-3">
    <template v-for="col in filterableColumns" :key="col.key">

      <!-- text -->
      <div v-if="col.filterType === 'text'">
        <label class="block text-xs font-medium text-muted-foreground mb-1">{{ col.label }}</label>
        <input
          type="text"
          :value="localFilters[col.key] ?? ''"
          @input="updateFilter(col.key, $event.target.value)"
          :placeholder="`Filtrar ${col.label.toLowerCase()}...`"
          class="w-full rounded-lg border border-card-line bg-card text-foreground py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <!-- select -->
      <div v-else-if="col.filterType === 'select'">
        <Forms.Select
          :model-value="localFilters[col.key] ?? ''"
          @update:model-value="updateFilter(col.key, $event)"
          :options="[{ value: '', label: 'Todos' }, ...(col.filterOptions ?? [])]"
          :label="col.label"
        />
      </div>

      <!-- daterange -->
      <div v-else-if="col.filterType === 'daterange'">
        <label class="block text-xs font-medium text-muted-foreground mb-1">{{ col.label }}</label>
        <div class="flex items-center gap-1.5">
          <input
            type="date"
            :value="localFilters[col.key]?.from ?? ''"
            @change="updateFilter(col.key, { ...localFilters[col.key], from: $event.target.value || null })"
            class="flex-1 rounded-lg border border-card-line bg-card text-foreground py-1.5 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span class="text-slate-400 text-xs shrink-0">—</span>
          <input
            type="date"
            :value="localFilters[col.key]?.to ?? ''"
            @change="updateFilter(col.key, { ...localFilters[col.key], to: $event.target.value || null })"
            class="flex-1 rounded-lg border border-card-line bg-card text-foreground py-1.5 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

    </template>

    <div class="pt-2 border-t border-card-line">
      <button
        v-if="activeCount > 0"
        type="button"
        @click="clearAll"
        class="w-full py-1.5 px-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors flex items-center justify-center gap-1.5"
      >
        <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        Limpiar filtros
      </button>
      <p v-else class="text-xs text-center text-muted-foreground py-0.5">Sin filtros activos</p>
    </div>
  </div>
</template>
