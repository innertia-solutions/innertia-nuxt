<script setup>
import {
  IconFileTypeXls,
  IconFileTypeCsv,
  IconFileTypePdf,
  IconCodeDots,
  IconDownload,
} from '@tabler/icons-vue'

const props = defineProps({
  tableRef: { type: Object, default: null },
  name:     { type: String, default: 'export' },
  columns:  { type: Array,  default: () => [] },
})

const isOpen          = ref(false)
const format          = ref('xlsx')
const filename        = ref(props.name)
const selectedColumns = ref([])

watch(() => props.columns, (cols) => { selectedColumns.value = cols.map(c => c.key) }, { immediate: true })
watch(() => props.name, (v) => { filename.value = v })

const toggleColumn = (key) => {
  const idx = selectedColumns.value.indexOf(key)
  if (idx >= 0) selectedColumns.value.splice(idx, 1)
  else selectedColumns.value.push(key)
}
const allSelected = computed(() => selectedColumns.value.length === props.columns.length)
const toggleAll   = () => {
  selectedColumns.value = allSelected.value ? [] : props.columns.map(c => c.key)
}

const formats = [
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv',  label: 'CSV'   },
  { value: 'pdf',  label: 'PDF'   },
  { value: 'json', label: 'JSON'  },
]

const doExport = () => {
  props.tableRef?.exportTable(format.value, true, true, selectedColumns.value)
  isOpen.value = false
}

const panelRef   = ref(null)
const triggerRef = ref(null)

const onOutsideClick = (e) => {
  if (
    panelRef.value   && !panelRef.value.contains(e.target) &&
    triggerRef.value && !triggerRef.value.contains(e.target)
  ) {
    isOpen.value = false
  }
}

watch(isOpen, (v) => {
  if (v) document.addEventListener('mousedown', onOutsideClick)
  else   document.removeEventListener('mousedown', onOutsideClick)
})

defineExpose({ open: () => { isOpen.value = true } })
</script>

<template>
  <div class="relative">

    <!-- Trigger — icon-only, igual al botón de columnas -->
    <button
      ref="triggerRef"
      type="button"
      @click="isOpen = !isOpen"
      title="Exportar"
      :class="[
        'p-1.5 inline-flex items-center justify-center rounded-lg border transition-colors',
        isOpen
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-transparent text-muted-foreground hover:border-card-line hover:bg-muted-hover hover:text-foreground'
      ]"
    >
      <IconDownload class="size-4" stroke="1.5" />
    </button>

    <Transition
      enter-active-class="transition ease-out duration-150"
      enter-from-class="opacity-0 translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-1 scale-95"
    >
      <div
        v-if="isOpen"
        ref="panelRef"
        class="absolute top-full right-0 z-50 mt-1.5 bg-dropdown border border-dropdown-line rounded-xl shadow-2xl p-3 w-64"
      >
        <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Exportar</p>

        <!-- Format -->
        <div class="grid grid-cols-4 gap-1.5 mb-3">
          <button
            v-for="f in formats"
            :key="f.value"
            type="button"
            @click="format = f.value"
            :class="[
              'flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors',
              format === f.value
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-card-line text-muted-foreground-1 hover:bg-muted-hover'
            ]"
          >
            <IconFileTypeXls v-if="f.value === 'xlsx'" class="size-4" stroke="1.5" />
            <IconFileTypeCsv v-else-if="f.value === 'csv'" class="size-4" stroke="1.5" />
            <IconFileTypePdf v-else-if="f.value === 'pdf'" class="size-4" stroke="1.5" />
            <IconCodeDots    v-else                         class="size-4" stroke="1.5" />
            {{ f.label }}
          </button>
        </div>

        <!-- Filename -->
        <div class="mb-3 px-1">
          <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Archivo</label>
          <div class="flex items-center gap-1.5">
            <input
              v-model="filename"
              type="text"
              class="flex-1 rounded-lg border border-card-line bg-card text-foreground py-1.5 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
            />
            <span class="text-xs text-muted-foreground shrink-0">.{{ format }}</span>
          </div>
        </div>

        <!-- Columns -->
        <div v-if="columns.length > 0" class="mb-3 px-1">
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Columnas</label>
            <button type="button" @click="toggleAll" class="text-[10px] text-primary hover:underline">
              {{ allSelected ? 'Ninguna' : 'Todas' }}
            </button>
          </div>
          <div class="max-h-32 overflow-y-auto space-y-0.5">
            <label
              v-for="col in columns"
              :key="col.key"
              class="flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-muted-hover cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="selectedColumns.includes(col.key)"
                @change="toggleColumn(col.key)"
                class="rounded border-card-line bg-surface shrink-0 cursor-pointer text-primary"
              />
              <span class="text-xs text-foreground truncate">{{ col.label }}</span>
            </label>
          </div>
        </div>

        <!-- Export button -->
        <button
          type="button"
          @click="doExport"
          class="w-full py-1.5 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
        >
          <IconDownload class="size-4" stroke="1.5" />
          Exportar
        </button>
      </div>
    </Transition>
  </div>
</template>
