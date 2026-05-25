<script setup>
import { IconSearch, IconAdjustmentsHorizontal, IconLayoutColumns, IconGripVertical, IconDownload, IconBookmark, IconChevronDown, IconX } from '@tabler/icons-vue'

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps({
  // DataTable wiring
  table:             { type: Object,  default: null },
  endpoint:          { type: String,  default: '' },
  endpointParams:    { type: Object,  default: () => ({}) },
  columns:           { type: Array,   required: true },
  name:              { type: String,  default: '' },
  params:            { type: Object,  default: () => ({}) },
  cached:            { type: Boolean, default: true },
  showReloadButton:  { type: Boolean, default: true },
  clickRowToOpen:    { type: Boolean, default: false },
  // Toolbar
  searchPlaceholder: { type: String,  default: 'Buscar...' },
  showSearch:        { type: Boolean, default: true },
  showFilters:       { type: Boolean, default: true },
  showColumns:       { type: Boolean, default: true },
  showExport:        { type: Boolean, default: true },
  showSaveView:      { type: Boolean, default: false },
  // Checkboxes
  checkable:         { type: Boolean, default: true },
  // Preview panel tabs: [{ key: 'resumen', label: 'Resumen' }, ...]
  previewTabs:       { type: Array,   default: () => [] },
  // Split ratio
  splitRatio:        { type: Number,  default: 55 },
  // Filters as chips in the filter bar: [{ key, label, options: [{value,label}] }]
  filterChips:       { type: Array,   default: () => [] },
})

const resolvedEndpoint = computed(() => props.table?.endpoint ?? props.endpoint)
const resolvedName     = computed(() => props.table?.name     ?? props.name)

// ─── Emits / Slots ────────────────────────────────────────────────────────────

const emit = defineEmits(['row-click', 'loaded', 'save-view'])
const slots = useSlots()

const excludedSlots = new Set(['toolbar', 'action', 'filter-bar', 'preview', 'preview-header'])
const forwardedSlots = computed(() =>
  Object.fromEntries(Object.entries(slots).filter(([k]) => !excludedSlots.has(k)))
)

// ─── Search & filters ─────────────────────────────────────────────────────────

const search        = ref('')
const activeFilters = ref({})

// Filter chips state: { [key]: selectedValue }
const chipValues = reactive(
  Object.fromEntries((props.filterChips ?? []).map(f => [f.key, '']))
)
const openChip = ref(null)

const clearChips = () => {
  for (const key of Object.keys(chipValues)) chipValues[key] = ''
}
const hasActiveChips = computed(() =>
  Object.values(chipValues).some(v => v !== '' && v !== null && v !== undefined)
)

// Advanced filter panel
const showFilterPanel = ref(false)
const filterPanelRef  = ref(null)

const filtersConfig = computed(() =>
  props.columns.filter(c => c.filterType)
)
const activeFilterCount = computed(() =>
  Object.values(activeFilters.value).filter(v => v !== null && v !== undefined && v !== '').length
)

const mergedParams = computed(() => ({
  ...props.params,
  ...props.endpointParams,
  ...activeFilters.value,
  ...Object.fromEntries(Object.entries(chipValues).filter(([, v]) => v !== '')),
}))

// ─── Preview panel ────────────────────────────────────────────────────────────

const previewRow      = ref(null)
const currentRatio    = ref(props.splitRatio)
const containerRef    = ref(null)
const previewEnabled  = ref(false)
const paginationHeight = ref(0)
const previewFromCache = ref(false)

const previewCacheKey = computed(() => `table-enterprise-preview-${resolvedName.value}`)

// Active preview tab
const firstTabKey = computed(() =>
  props.previewTabs?.length ? props.previewTabs[0].key : 'datos'
)
const previewTab = ref(firstTabKey.value)
watch(previewRow, () => { previewTab.value = firstTabKey.value })

const closePreview = () => { previewRow.value = null }

const tableRef  = ref(null)
const tableMeta = ref(null)

const handleRowClick = (row) => {
  if (previewEnabled.value) {
    previewRow.value = previewRow.value?.id === row.id ? null : row
  } else {
    emit('row-click', row)
  }
}

const handleLoaded = (res) => {
  emit('loaded', res)
  if (res?.meta) tableMeta.value = res.meta
  if (previewRow.value && Array.isArray(res?.data)) {
    const fresh = res.data.find(r => r.id === previewRow.value.id)
    if (fresh) previewRow.value = fresh
    else closePreview()
  }
}

// Persist preview in session cache
watch(previewRow, (row) => {
  if (!props.cached) return
  if (row) sessionStorage.setItem(previewCacheKey.value, JSON.stringify(row))
  else sessionStorage.removeItem(previewCacheKey.value)
})

// Track pagination height
let paginationObserver = null
watch(() => tableRef.value?.paginationBarRef, (el) => {
  paginationObserver?.disconnect()
  paginationObserver = null
  if (!el) return
  paginationHeight.value = el.offsetHeight
  paginationObserver = new ResizeObserver(() => { paginationHeight.value = el.offsetHeight })
  paginationObserver.observe(el)
}, { flush: 'post' })

// Resize handle
const startResize = (e) => {
  e.preventDefault()
  const onMove = (ev) => {
    if (!containerRef.value) return
    const rect = containerRef.value.getBoundingClientRect()
    const ratio = ((ev.clientX - rect.left) / rect.width) * 100
    currentRatio.value = Math.min(80, Math.max(25, ratio))
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// ─── Column panel ─────────────────────────────────────────────────────────────

const showColumnPanel  = ref(false)
const columnPanelRef   = ref(null)
const columnButtonRef  = ref(null)
const columnPanelStyle = ref({})

const orderedColumns = computed(() => {
  if (!tableRef.value) return props.columns.filter(c => c.label)
  const ids = tableRef.value.table.getAllLeafColumns().map(c => c.id).filter(id => id !== 'select')
  return ids.map(id => props.columns.find(c => c.key === id)).filter(c => c?.label)
})

let draggedKey = null
const dragOverKey = ref(null)
const onDragStart = (key) => { draggedKey = key }
const onDragOver  = (e, key) => { e.preventDefault(); dragOverKey.value = key }
const onDragLeave = () => { dragOverKey.value = null }
const onDrop = (key) => {
  if (!draggedKey || draggedKey === key) return
  const ids = tableRef.value?.table.getAllLeafColumns().map(c => c.id) ?? []
  const from = ids.indexOf(draggedKey)
  const to   = ids.indexOf(key)
  if (from < 0 || to < 0) return
  ids.splice(from, 1); ids.splice(to, 0, draggedKey)
  const selIdx = ids.indexOf('select')
  if (selIdx > 0) { ids.splice(selIdx, 1); ids.unshift('select') }
  tableRef.value?.setColumnOrder(ids)
  draggedKey = null; dragOverKey.value = null
}

// ─── Outside-click helpers ────────────────────────────────────────────────────

const onColumnOutsideClick = (e) => {
  if (
    columnPanelRef.value && !columnPanelRef.value.contains(e.target) &&
    columnButtonRef.value && !columnButtonRef.value.contains(e.target)
  ) showColumnPanel.value = false
}
const onFilterOutsideClick = (e) => {
  if (filterPanelRef.value && !filterPanelRef.value.contains(e.target)) showFilterPanel.value = false
}

watch(showColumnPanel, async (v) => {
  if (v) {
    await nextTick()
    const rect = columnButtonRef.value?.getBoundingClientRect()
    if (rect) columnPanelStyle.value = { top: rect.bottom + 6 + 'px', right: window.innerWidth - rect.right + 'px' }
    document.addEventListener('mousedown', onColumnOutsideClick)
  } else {
    document.removeEventListener('mousedown', onColumnOutsideClick)
  }
})
watch(showFilterPanel, (v) => {
  if (v) document.addEventListener('mousedown', onFilterOutsideClick)
  else document.removeEventListener('mousedown', onFilterOutsideClick)
})

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const onEsc = (e) => { if (e.key === 'Escape' && previewRow.value) closePreview() }
onMounted(async () => {
  previewEnabled.value = !!(slots.preview)
  window.addEventListener('keydown', onEsc)
  if (props.cached && previewEnabled.value) {
    try {
      const raw = sessionStorage.getItem(previewCacheKey.value)
      if (raw) {
        previewFromCache.value = true
        previewRow.value = JSON.parse(raw)
        await nextTick()
        previewFromCache.value = false
      }
    } catch {}
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEsc)
  paginationObserver?.disconnect()
})

// ─── Expose ───────────────────────────────────────────────────────────────────

const getSelectedRows = () => tableRef.value?.getSelectedRows()
const reload          = () => tableRef.value?.reload()
const clearCache      = () => tableRef.value?.clearCache()
const exportTable     = (format, allPages, filteredRows) => tableRef.value?.exportTable(format, allPages, filteredRows)
defineExpose({ getSelectedRows, reload, clearCache, exportTable, tableRef, closePreview })
</script>

<template>
  <div class="relative" ref="containerRef">
    <div class="bg-card border border-card-line rounded-card shadow-sm overflow-hidden">

      <!-- ── Toolbar ──────────────────────────────────────────────────────── -->
      <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-card-line">

        <!-- Search -->
        <div v-if="showSearch" class="flex-1 min-w-48">
          <Forms.Input v-model="search" type="search" :placeholder="searchPlaceholder" :icon-left="IconSearch" size="sm" />
        </div>

        <!-- Advanced filters button -->
        <button
          v-if="showFilters && filtersConfig.length > 0"
          type="button"
          @click="showFilterPanel = !showFilterPanel"
          :class="[
            'py-1.5 px-3 inline-flex items-center gap-1.5 text-sm font-medium rounded-control border transition-colors',
            showFilterPanel || activeFilterCount > 0
              ? 'border-primary/50 bg-primary/5 text-primary dark:bg-primary/10'
              : 'border-card-line bg-card text-muted-foreground-1 hover:bg-muted-hover',
          ]"
        >
          <IconAdjustmentsHorizontal class="size-4" stroke="1.5" />
          Filtros
          <span v-if="activeFilterCount > 0" class="text-xs font-bold">({{ activeFilterCount }})</span>
          <IconChevronDown class="size-3.5" stroke="2" />
        </button>

        <!-- Toolbar slot (custom filter dropdowns, etc.) -->
        <slot name="toolbar" />

        <!-- Spacer -->
        <div class="flex-1" />

        <!-- Save view -->
        <button
          v-if="showSaveView"
          type="button"
          class="py-1.5 px-3 inline-flex items-center gap-1.5 text-sm font-medium rounded-control border border-card-line bg-card text-muted-foreground-1 hover:bg-muted-hover transition-colors"
          @click="emit('save-view')"
        >
          <IconBookmark class="size-4" stroke="1.5" />
          Guardar vista
        </button>

        <!-- Columns -->
        <button
          v-if="showColumns"
          ref="columnButtonRef"
          type="button"
          @click="showColumnPanel = !showColumnPanel"
          :class="[
            'py-1.5 px-3 inline-flex items-center gap-1.5 text-sm font-medium rounded-control border transition-colors',
            showColumnPanel
              ? 'border-primary/50 bg-primary/5 text-primary dark:bg-primary/10'
              : 'border-card-line bg-card text-muted-foreground-1 hover:bg-muted-hover',
          ]"
        >
          <IconLayoutColumns class="size-4" stroke="1.5" />
          Columnas
        </button>

        <!-- Export -->
        <TableExportable v-if="showExport" :table-ref="tableRef" :name="resolvedName" :columns="columns" />

        <!-- Primary action slot -->
        <slot name="action" />
      </div>

      <!-- ── Filter bar (chips) ───────────────────────────────────────────── -->
      <div
        v-if="filterChips.length > 0 || $slots['filter-bar']"
        class="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-card-line bg-surface/40"
      >
        <!-- Built-in chips from filterChips prop -->
        <template v-if="filterChips.length > 0">
          <div
            v-for="chip in filterChips"
            :key="chip.key"
            class="relative"
          >
            <button
              type="button"
              @click="openChip = openChip === chip.key ? null : chip.key"
              :class="[
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-badge text-sm border transition-colors',
                chipValues[chip.key]
                  ? 'border-primary/50 bg-primary/5 text-primary font-medium dark:bg-primary/10'
                  : 'border-card-line bg-card text-muted-foreground hover:bg-muted-hover',
              ]"
            >
              <span class="text-muted-foreground">{{ chip.label }}:</span>
              <span class="font-medium">
                {{ chip.options?.find(o => o.value === chipValues[chip.key])?.label ?? 'Todos' }}
              </span>
              <IconChevronDown class="size-3" stroke="2" />
            </button>

            <!-- Chip dropdown -->
            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
            >
              <div
                v-if="openChip === chip.key"
                v-click-outside="() => openChip = null"
                class="absolute top-full left-0 z-50 mt-1 bg-dropdown border border-dropdown-line rounded-popover shadow-xl py-1 min-w-40"
              >
                <button
                  type="button"
                  class="w-full text-left px-3 py-1.5 text-sm hover:bg-muted-hover transition-colors"
                  :class="chipValues[chip.key] === '' ? 'font-semibold text-foreground' : 'text-muted-foreground'"
                  @click="chipValues[chip.key] = ''; openChip = null"
                >Todos</button>
                <button
                  v-for="opt in chip.options"
                  :key="opt.value"
                  type="button"
                  class="w-full text-left px-3 py-1.5 text-sm hover:bg-muted-hover transition-colors"
                  :class="chipValues[chip.key] === opt.value ? 'font-semibold text-foreground' : 'text-muted-foreground'"
                  @click="chipValues[chip.key] = opt.value; openChip = null"
                >{{ opt.label }}</button>
              </div>
            </Transition>
          </div>

          <button
            v-if="hasActiveChips"
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            @click="clearChips"
          >
            <IconX class="size-3" stroke="2" />
            Limpiar filtros
          </button>
        </template>

        <!-- Custom filter bar slot -->
        <slot name="filter-bar" />
      </div>

      <!-- Advanced filter panel -->
      <Transition
        enter-active-class="transition ease-out duration-150"
        enter-from-class="opacity-0 translate-y-1 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-1 scale-95"
      >
        <div
          v-if="showFilterPanel"
          ref="filterPanelRef"
          class="absolute top-14 left-4 z-50 bg-dropdown border border-dropdown-line rounded-popover shadow-2xl p-3 min-w-64 max-h-96 overflow-y-auto"
        >
          <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Filtros avanzados</p>
          <TableFilter v-model="activeFilters" :columns="filtersConfig" />
        </div>
      </Transition>

      <!-- ── Table + Preview ──────────────────────────────────────────────── -->
      <div class="relative overflow-hidden">

        <Table
          ref="tableRef"
          :endpoint="resolvedEndpoint"
          :columns="columns"
          :name="resolvedName"
          :params="mergedParams"
          :search="search"
          :checkable="checkable"
          :cached="cached"
          :show-reload-button="showReloadButton"
          :click-row-to-open="clickRowToOpen"
          :preview-row-id="previewRow?.id ?? null"
          :preview-mode="!!previewEnabled"
          @row-click="handleRowClick"
          @loaded="handleLoaded"
          @page-change="closePreview"
          @per-page-change="closePreview"
        >
          <template v-for="(_, sname) in forwardedSlots" #[sname]="slotProps">
            <slot :name="sname" v-bind="slotProps ?? {}" />
          </template>
        </Table>

        <!-- Preview overlay -->
        <Transition
          :enter-active-class="previewFromCache ? '' : 'transition ease-out duration-200'"
          :enter-from-class="previewFromCache ? '' : 'opacity-0 translate-x-6'"
          :enter-to-class="previewFromCache ? '' : 'opacity-100 translate-x-0'"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="opacity-100 translate-x-0"
          leave-to-class="opacity-0 translate-x-6"
        >
          <div
            v-if="previewRow && previewEnabled"
            class="absolute top-0 right-0 z-30 flex bg-card border-l border-card-line shadow-[-4px_0_16px_rgba(0,0,0,0.06)]"
            :style="{ width: (100 - currentRatio) + '%', bottom: paginationHeight + 'px' }"
          >
            <!-- Resize handle -->
            <div
              class="w-1 shrink-0 cursor-col-resize bg-surface hover:bg-primary/40 transition-colors"
              @mousedown="startResize"
            />

            <div class="flex flex-col flex-1 overflow-hidden">

              <!-- Fixed header -->
              <div v-if="$slots['preview-header']" class="shrink-0 border-b border-card-line">
                <slot name="preview-header" :row="previewRow" :close="closePreview" />
              </div>

              <!-- Tabs (top) — only if previewTabs provided -->
              <div
                v-if="previewTabs && previewTabs.length > 1"
                class="shrink-0 flex border-b border-card-line overflow-x-auto"
              >
                <button
                  v-for="tab in previewTabs"
                  :key="tab.key"
                  type="button"
                  @click="previewTab = tab.key"
                  :class="[
                    'px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px',
                    previewTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted-hover',
                  ]"
                >{{ tab.label }}</button>
              </div>

              <!-- Scrollable preview content -->
              <div class="flex-1 overflow-y-auto min-h-0">
                <slot name="preview" :row="previewRow" :tab="previewTab" :close="closePreview" />
              </div>

            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Column panel (teleported) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-150"
        enter-from-class="opacity-0 translate-y-1 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-1 scale-95"
      >
        <div
          v-if="showColumnPanel"
          ref="columnPanelRef"
          class="fixed z-50 bg-dropdown border border-dropdown-line rounded-popover shadow-2xl p-3 min-w-56 max-h-80 overflow-y-auto"
          :style="columnPanelStyle"
        >
          <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Columnas visibles</p>
          <div
            v-for="col in orderedColumns"
            :key="col.key"
            draggable="true"
            @dragstart="onDragStart(col.key)"
            @dragover="(e) => onDragOver(e, col.key)"
            @dragleave="onDragLeave"
            @drop="onDrop(col.key)"
            class="flex items-center gap-2 py-1.5 px-2 rounded-control select-none transition-colors"
            :class="dragOverKey === col.key ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted-hover cursor-grab'"
          >
            <IconGripVertical class="size-4 text-muted-foreground-2 shrink-0" />
            <input
              type="checkbox"
              :checked="tableRef?.table.getColumn(col.key)?.getIsVisible() ?? true"
              @change="tableRef?.table.getColumn(col.key)?.toggleVisibility()"
              @click.stop
              class="rounded border-card-line bg-surface shrink-0 cursor-pointer"
            />
            <span class="text-sm text-foreground truncate">{{ col.label }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
