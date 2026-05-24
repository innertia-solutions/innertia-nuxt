<script setup>
import { IconSearch, IconLayoutColumns, IconGripVertical, IconMinus, IconMaximize, IconX, IconPlus, IconChevronLeft, IconCheck, IconChevronDown, IconExternalLink, IconTrash } from '@tabler/icons-vue'
import Table from './index.vue'

const props = defineProps({
  table:                   { type: Object,  default: null },
  endpoint:                { type: String,  default: '' },
  columns:                 { type: Array,   required: true },
  name:                    { type: String,  default: '' },
  params:                  { type: Object,  default: () => ({}) },
  checkable:               { type: Boolean, default: false },
  cached:                  { type: Boolean, default: false },
  showReloadButton:        { type: Boolean, default: true },
  clickRowToOpen:          { type: Boolean, default: false },
  searchPlaceholder:       { type: String,  default: 'Buscar...' },
  showSearch:              { type: Boolean, default: true },
  showFilters:             { type: Boolean, default: true },
  showExport:              { type: Boolean, default: true },
  filters:                 { type: Array,   default: () => [] },
  splitRatio:              { type: Number,           default: 60 },
  autoClosePreview:        { type: Boolean,          default: true },
  previewHref:             { type: [String, Function], default: null },   // url fija o (row) => url
  previewDeletable:        { type: Boolean,          default: false },
  defaultPinnedColumns:    { type: Object,  default: null }, // { left?: string[], right?: string[] }
  persistPreferences:      { type: Boolean, default: true }, // persist column prefs in backend
})

const resolvedEndpoint = computed(() => props.table?.endpoint ?? props.endpoint)
const resolvedName     = computed(() => props.table?.name     ?? props.name)

// ─── Table preferences (column pinning, visibility, order) ───────────────────
const tablePrefName = computed(() => resolvedName.value || 'default')
const { preferences: tablePrefs, load: loadPrefs, save: savePrefs } = useTablePreferences(tablePrefName.value)

// Resolved initial pinned columns: merge defaultPinnedColumns with saved preferences
const resolvedPinnedColumns = computed(() => {
  const saved = tablePrefs.value.pinning
  if (saved) return saved
  return props.defaultPinnedColumns ?? null
})

const emit = defineEmits(['row-click', 'loaded', 'preview-delete'])
const slots = useSlots()
const forwardedSlots = computed(() => {
  const excluded = new Set(['toolbar', 'preview'])
  return Object.fromEntries(Object.entries(slots).filter(([k]) => !excluded.has(k)))
})

const search        = ref('')
const activeFilters = ref({})
const tableRef      = ref(null)
const prefsLoaded   = ref(false)

// ─── Filter config ─────────────────────────────────────────────────────────────
const filtersConfig = computed(() =>
  props.filters?.length ? props.filters : props.columns.filter(c => c.filterType)
)

const hasFilterableColumns = computed(() => filtersConfig.value.length > 0)

// ─── Notion-style filter ───────────────────────────────────────────────────────
const showFilterPanel  = ref(false)
const filterMenuStep   = ref('columns') // 'columns' | 'value'
const pendingCol       = ref(null)
const pendingValue     = ref(null)   // string for text/select, { singleDate, from, to } for daterange
const pendingDateOp    = ref('before') // 'before' | 'after' | 'between'
const filterMenuRef    = ref(null)
const filterAddBtnRef  = ref(null)
const filterMenuStyle  = ref({})

const pendingOperator = ref('contains')
const pendingValueInputRef = ref(null)

const textOps = [
  { value: 'contains',    label: 'contiene' },
  { value: 'starts_with', label: 'empieza con' },
  { value: 'equals',      label: 'es igual a' },
]

const selectOps = [
  { value: 'is',     label: 'es' },
  { value: 'is_not', label: 'no es' },
]

const dateOps = [
  { value: 'before',  label: 'antes de' },
  { value: 'after',   label: 'después de' },
  { value: 'between', label: 'entre' },
]

const activeFilterList = computed(() =>
  filtersConfig.value
    .filter(col => {
      const v = activeFilters.value[col.key]
      if (!v) return false
      if (col.filterType === 'daterange') return v?.from || v?.to
      return v?.value !== null && v?.value !== undefined && v?.value !== ''
    })
    .map(col => {
      const v = activeFilters.value[col.key]
      let displayOp = '', displayVal = ''
      if (col.filterType === 'daterange') {
        if (v.from && v.to) { displayOp = 'entre'; displayVal = `${v.from} y ${v.to}` }
        else if (v.from) { displayOp = 'después de'; displayVal = v.from }
        else { displayOp = 'antes de'; displayVal = v.to }
      } else if (col.filterType === 'select') {
        const op = selectOps.find(o => o.value === v.operator) ?? selectOps[0]
        displayOp = op.label
        displayVal = col.filterOptions?.find(o => o.value === v.value)?.label ?? v.value
      } else {
        const op = textOps.find(o => o.value === v.operator) ?? textOps[0]
        displayOp = op.label
        displayVal = v.value
      }
      return { key: col.key, label: col.label, displayOp, displayVal, col }
    })
)

const activeFilterCount = computed(() => activeFilterList.value.length)

// Columns NOT yet filtered — what appears in the picker (already-active columns are hidden)
const availableFilterColumns = computed(() =>
  filtersConfig.value.filter(col => {
    const v = activeFilters.value[col.key]
    if (!v) return true
    if (col.filterType === 'daterange') return !v.from && !v.to
    return !v.value
  })
)

// Convert activeFilters to enriched [{field, operator, value}] for the backend DataTable
const enrichedFilters = computed(() => {
  const result = []
  for (const col of filtersConfig.value) {
    const v = activeFilters.value[col.key]
    if (!v) continue
    if (col.filterType === 'daterange') {
      if (!v.from && !v.to) continue
      if (v.from) result.push({ field: col.key, operator: 'after',  value: v.from })
      if (v.to)   result.push({ field: col.key, operator: 'before', value: v.to })
    } else {
      if (!v.value) continue
      result.push({ field: col.key, operator: v.operator ?? 'contains', value: v.value })
    }
  }
  return result
})

const mergedParams = computed(() => ({
  ...props.params,
  ...(enrichedFilters.value.length ? { filters: enrichedFilters.value } : {}),
}))

const removeFilter = (key) => {
  const u = { ...activeFilters.value }; delete u[key]; activeFilters.value = u
}

const updateFilterMenuPosition = () => {
  const rect = filterAddBtnRef.value?.getBoundingClientRect()
  if (rect) filterMenuStyle.value = { top: rect.bottom + 4 + 'px', left: rect.left + 'px' }
}

const openFilterMenu = async () => {
  filterMenuStep.value = 'columns'
  pendingCol.value = null
  showFilterPanel.value = true
  await nextTick()
  updateFilterMenuPosition()
}

const toggleFilterMenu = async () => {
  if (showFilterPanel.value) { closeFilterMenu() } else { await openFilterMenu() }
}

const closeFilterMenu = () => {
  showFilterPanel.value = false
  filterMenuStep.value = 'columns'
  pendingCol.value = null
  pendingValue.value = null
}

const selectFilterColumn = (col) => {
  pendingCol.value = col
  const existing = activeFilters.value[col.key]
  if (col.filterType === 'daterange') {
    if (existing?.from && existing?.to) { pendingDateOp.value = 'between'; pendingValue.value = { from: existing.from, to: existing.to, singleDate: '' } }
    else if (existing?.from) { pendingDateOp.value = 'after'; pendingValue.value = { singleDate: existing.from, from: '', to: '' } }
    else if (existing?.to) { pendingDateOp.value = 'before'; pendingValue.value = { singleDate: existing.to, from: '', to: '' } }
    else { pendingDateOp.value = 'before'; pendingValue.value = { singleDate: '', from: '', to: '' } }
  } else {
    pendingOperator.value = existing?.operator ?? (col.filterType === 'select' ? 'is' : 'contains')
    pendingValue.value = existing?.value ?? ''
  }
  filterMenuStep.value = 'value'
}

const applyPendingFilter = () => {
  if (!pendingCol.value) return
  const col = pendingCol.value
  let v
  if (col.filterType === 'daterange') {
    if (pendingDateOp.value === 'between') v = { from: pendingValue.value.from, to: pendingValue.value.to }
    else if (pendingDateOp.value === 'after') v = { from: pendingValue.value.singleDate }
    else v = { to: pendingValue.value.singleDate }
  } else {
    v = { value: pendingValue.value, operator: pendingOperator.value }
  }
  activeFilters.value = { ...activeFilters.value, [col.key]: v }
  closeFilterMenu()
}

const openEditFilter = async (col) => {
  selectFilterColumn(col)
  showFilterPanel.value = true
  await nextTick()
  const rect = filterAddBtnRef.value?.getBoundingClientRect()
  if (rect) filterMenuStyle.value = { top: rect.bottom + 4 + 'px', left: rect.left + 'px' }
}

const onFilterMenuOutsideClick = (e) => {
  if (filterMenuRef.value && !filterMenuRef.value.contains(e.target) &&
      filterAddBtnRef.value && !filterAddBtnRef.value.contains(e.target)) {
    closeFilterMenu()
  }
}
watch(showFilterPanel, v => {
  if (v) {
    document.addEventListener('mousedown', onFilterMenuOutsideClick)
    window.addEventListener('scroll', updateFilterMenuPosition, true)
    window.addEventListener('resize', updateFilterMenuPosition)
  } else {
    document.removeEventListener('mousedown', onFilterMenuOutsideClick)
    window.removeEventListener('scroll', updateFilterMenuPosition, true)
    window.removeEventListener('resize', updateFilterMenuPosition)
  }
})

watch(filterMenuStep, async (step) => {
  if (step === 'value' && pendingCol.value?.filterType === 'text') {
    await nextTick()
    pendingValueInputRef.value?.focus()
  }
})

// ─── Preview href helper ───────────────────────────────────────────────────────
const resolvedPreviewHref = computed(() => {
  if (!props.previewHref || !previewRow.value) return null
  return typeof props.previewHref === 'function'
    ? props.previewHref(previewRow.value)
    : props.previewHref
})

// ─── Preview panel ─────────────────────────────────────────────────────────────
const previewRow      = ref(null)
const currentRatio    = ref(props.splitRatio)
const containerRef    = ref(null)
const previewEnabled  = ref(false)
const paginationHeight = ref(0)

const previewCacheKey = computed(() => `table-preview-${resolvedName.value}`)

const previewFromCache = ref(false)
const previewPanelRef = ref(null)
const closePreview = () => { previewRow.value = null }

const previewTab  = ref('datos')
const tableMeta   = ref(null)

const hasHistory = computed(() => !!tableMeta.value?.has_history)
const resolvedHistoryEndpoint = computed(() => {
  if (!hasHistory.value || !previewRow.value?.id || !tableMeta.value?.entity_type) return null
  return `history/${tableMeta.value.entity_type}/${previewRow.value.id}`
})

watch(previewRow, async (row) => {
  previewTab.value = 'datos'
  if (row) {
    await nextTick()
    if (typeof window !== 'undefined') window.HSStaticMethods?.autoInit?.(['Tooltip'])
  }
})

const handleRowClick = (row) => {
  if (previewEnabled.value) {
    if (previewRow.value?.id === row.id) return  // ya está abierto, no pestañear
    collapseDock()
    previewRow.value = row
  } else {
    emit('row-click', row)
  }
}

// Persist preview row in session cache when table cache is enabled
watch(previewRow, (row) => {
  if (!props.cached) return
  if (row) sessionStorage.setItem(previewCacheKey.value, JSON.stringify(row))
  else sessionStorage.removeItem(previewCacheKey.value)
})

// When data reloads, update previewRow with fresh data — close silently if deleted
const handleLoaded = (res) => {
  emit('loaded', res)
  if (res?.meta) tableMeta.value = res.meta
  if (previewRow.value && Array.isArray(res?.data)) {
    const fresh = res.data.find(r => r.id === previewRow.value.id)
    if (fresh) previewRow.value = fresh
    else closePreview()
  }
}

// Track pagination bar height so the overlay never covers it
let paginationObserver = null
watch(() => tableRef.value?.paginationBarRef, (el) => {
  paginationObserver?.disconnect()
  paginationObserver = null
  if (!el) return
  paginationHeight.value = el.offsetHeight
  paginationObserver = new ResizeObserver(() => {
    paginationHeight.value = el.offsetHeight
  })
  paginationObserver.observe(el)
}, { flush: 'post' })

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

const onEsc = (e) => { if (e.key === 'Escape') { if (previewRow.value) closePreview(); else collapseDock() } }

// ─── Auto-close preview on outside click ──────────────────────────────────────
const onDocMousedown = (e) => {
  if (props.autoClosePreview && previewRow.value && previewPanelRef.value && !previewPanelRef.value.contains(e.target)) {
    closePreview()
  }
}

// ─── Dock (minimizar preview) ──────────────────────────────────────────────────
const {
  docked,
  dock, undock: undockItem, isActive,
  activeDockId, activeDockRect,
  expandDock, collapseDock,
} = useDockedPreviews()
const route = useRoute()

function minimizePreview() {
  if (!previewRow.value) return
  const label    = previewRow.value.name ?? previewRow.value.title ?? previewRow.value.email ?? String(previewRow.value.id)
  const subtitle = previewRow.value.email ?? previewRow.value.description ?? null
  dock({
    id:        `${resolvedName.value}-${previewRow.value.id}`,
    label,
    subtitle,
    row:       { ...previewRow.value },
    tableName: resolvedName.value,
    route:     route.path,
  })
  closePreview()
}

// Item que debe mostrarse como mini-preview flotante (pertenece a esta tabla)
const floatingItem = computed(() =>
  activeDockId.value
    ? docked.value.find(d => d.id === activeDockId.value && d.tableName === resolvedName.value) ?? null
    : null
)

// Posición del panel flotante: centrado sobre el tab que lo abrió
const floatingPanelStyle = computed(() => {
  const rect   = activeDockRect.value
  const panelW = 384
  const bottom = 52
  if (!rect || typeof window === 'undefined') return { bottom: bottom + 'px', right: '16px' }
  const tabCenter = rect.left + rect.width / 2
  let right = window.innerWidth - tabCenter - panelW / 2
  right = Math.max(8, Math.min(right, window.innerWidth - panelW - 8))
  return { bottom: bottom + 'px', right: right + 'px' }
})

function expandToFull(item) {
  previewRow.value = item.row
  undockItem(item.id)
}

// Escuchar evento de restauración (fallback cuando la tabla no estaba montada)
onMounted(() => {
  useNuxtApp().hooks.hook('preview:restore', (item) => {
    if (item.tableName === resolvedName.value) previewRow.value = item.row
  })
})

onMounted(async () => {
  previewEnabled.value = !!slots.preview
  window.addEventListener('keydown', onEsc)
  document.addEventListener('mousedown', onDocMousedown)
  // Restore preview from session cache — mark as from-cache to skip enter animation
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

  // Load column preferences from backend
  if (props.persistPreferences && resolvedName.value) {
    await loadPrefs()
    // Apply saved visibility
    if (tablePrefs.value.visibility && tableRef.value?.table) {
      tableRef.value.table.setColumnVisibility(tablePrefs.value.visibility)
    }
    // Apply saved column order
    if (tablePrefs.value.order?.length && tableRef.value?.setColumnOrder) {
      tableRef.value.setColumnOrder(tablePrefs.value.order)
    }
    // Apply saved pinning
    if (tablePrefs.value.pinning && tableRef.value?.table) {
      tableRef.value.table.setColumnPinning(tablePrefs.value.pinning)
    }
  }
  prefsLoaded.value = true
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEsc)
  document.removeEventListener('mousedown', onDocMousedown)
  paginationObserver?.disconnect()
})

// ─── Column panel ─────────────────────────────────────────────────────────────
const showColumnPanel   = ref(false)
const columnPanelRef    = ref(null)
const columnButtonRef   = ref(null)
const columnPanelStyle  = ref({})

const orderedColumns = computed(() => {
  if (!tableRef.value) return props.columns.filter(c => c.label)
  const ids = tableRef.value.table.getAllLeafColumns().map(c => c.id).filter(id => id !== 'select')
  return ids.map(id => props.columns.find(c => c.key === id)).filter(c => c?.label)
})

let draggedKey = null
let draggedFromSection = null // 'left' | 'center' | 'right'
const dragOverKey     = ref(null)
const dragOverSection = ref(null)

// ─── Columns grouped by pinning section ───────────────────────────────────────
const columnsBySection = computed(() => {
  // reactive dependency on pinning state
  const _pin = tableRef.value?.columnPinning?.value
  const cols = orderedColumns.value
  if (!tableRef.value?.table) return { left: [], center: cols, right: [] }

  const left = [], center = [], right = []
  for (const col of cols) {
    const pinned = tableRef.value.table.getColumn(col.key)?.getIsPinned()
    if (pinned === 'left')       left.push(col)
    else if (pinned === 'right') right.push(col)
    else                         center.push(col)
  }
  return { left, center, right }
})

const resetColDrag = () => {
  draggedKey = null
  draggedFromSection = null
  dragOverKey.value = null
  dragOverSection.value = null
}

const onDragStart = (key, section) => { draggedKey = key; draggedFromSection = section }
const onDragLeave = () => { dragOverKey.value = null }

// Auto-pin anchor columns when any column enters/leaves a pinned section:
//   Left section  → checkbox (select) is always pinned left
//   Right section → actions column is always pinned right
// Called AFTER pinColumn(draggedKey) so columnsBySection reflects the new state.
const enforceAnchorPins = (targetSection) => {
  const t = tableRef.value
  if (!t) return
  const from = draggedFromSection // still valid before resetColDrag()

  // ─── Left anchor: select checkbox ────────────────────────────────────────────
  // Order (select always first) is enforced by a watch in Table/index.vue
  if (props.checkable && t.table?.getColumn('select')) {
    if (targetSection === 'left') {
      t.pinColumn('select', 'left')
    } else if (from === 'left' && columnsBySection.value.left.length === 0) {
      t.pinColumn('select', false)
    }
  }

  // ─── Right anchor: actions ────────────────────────────────────────────────────
  // 'actions' has label:'' so it's excluded from orderedColumns/columnsBySection.
  // We only auto-pin it if it exists in the columns definition.
  const hasActions = props.columns.some(c => c.key === 'actions')
  if (hasActions) {
    if (targetSection === 'right') {
      // Something was pinned right → force-pin actions too
      t.pinColumn('actions', 'right')
    } else if (from === 'right') {
      // Something left the right section → unpin actions if no more right columns
      if (columnsBySection.value.right.length === 0) t.pinColumn('actions', false)
    }
  }
}

// Drop on a specific column row (handles both reorder + section change)
const onDrop = (targetKey, targetSection) => {
  if (!draggedKey) { resetColDrag(); return }

  if (draggedFromSection !== targetSection) {
    // Change pinning
    const pinVal = targetSection === 'left' ? 'left' : targetSection === 'right' ? 'right' : false
    tableRef.value?.pinColumn(draggedKey, pinVal)
    enforceAnchorPins(targetSection)
    persistCurrentPrefs()
  } else if (draggedKey !== targetKey) {
    // Reorder within section
    const ids = tableRef.value?.table.getAllLeafColumns().map(c => c.id) ?? []
    const from = ids.indexOf(draggedKey)
    const to   = ids.indexOf(targetKey)
    if (from >= 0 && to >= 0) {
      ids.splice(from, 1)
      ids.splice(to, 0, draggedKey)
      const selIdx = ids.indexOf('select')
      if (selIdx > 0) { ids.splice(selIdx, 1); ids.unshift('select') }
      tableRef.value?.setColumnOrder(ids)
    }
  }
  resetColDrag()
}

// Drop on the section zone itself (empty area) — only changes pinning
const onDropSection = (targetSection) => {
  if (!draggedKey || draggedFromSection === targetSection) { resetColDrag(); return }
  const pinVal = targetSection === 'left' ? 'left' : targetSection === 'right' ? 'right' : false
  tableRef.value?.pinColumn(draggedKey, pinVal)
  enforceAnchorPins(targetSection)
  persistCurrentPrefs()
  resetColDrag()
}

const onColumnPanelOutsideClick = (e) => {
  if (
    columnPanelRef.value && !columnPanelRef.value.contains(e.target) &&
    columnButtonRef.value && !columnButtonRef.value.contains(e.target)
  ) {
    showColumnPanel.value = false
  }
}

const updateColumnPanelPosition = () => {
  const rect = columnButtonRef.value?.getBoundingClientRect()
  if (rect) columnPanelStyle.value = { top: rect.bottom + 6 + 'px', right: window.innerWidth - rect.right + 'px' }
}

watch(showColumnPanel, async (v) => {
  if (v) {
    await nextTick()
    updateColumnPanelPosition()
    document.addEventListener('mousedown', onColumnPanelOutsideClick)
    window.addEventListener('scroll', updateColumnPanelPosition, true)
    window.addEventListener('resize', updateColumnPanelPosition)
  } else {
    document.removeEventListener('mousedown', onColumnPanelOutsideClick)
    window.removeEventListener('scroll', updateColumnPanelPosition, true)
    window.removeEventListener('resize', updateColumnPanelPosition)
  }
})

// ─── Persist column preferences when they change ─────────────────────────────
const persistCurrentPrefs = () => {
  if (!props.persistPreferences || !resolvedName.value || !prefsLoaded.value || !tableRef.value) return
  const tanTable = tableRef.value.table
  if (!tanTable) return

  const visibility = Object.fromEntries(
    tanTable.getAllLeafColumns()
      .filter(c => c.id !== 'select')
      .map(c => [c.id, c.getIsVisible()])
  )
  const order = tanTable.getAllLeafColumns().map(c => c.id).filter(id => id !== 'select')
  const rawPinning = tableRef.value.columnPinning?.value ?? tanTable.getState().columnPinning
  const pinning = rawPinning
    ? { left: rawPinning.left ?? [], right: rawPinning.right ?? [] }
    : { left: [], right: [] }

  savePrefs({ visibility, order, pinning })
}

// Watch column pinning changes via tableRef
watch(
  () => tableRef.value?.columnPinning?.value,
  () => { if (prefsLoaded.value) persistCurrentPrefs() },
  { deep: true }
)

// Watch column visibility changes
watch(
  () => tableRef.value?.table?.getState()?.columnVisibility,
  () => { if (prefsLoaded.value) persistCurrentPrefs() },
  { deep: true }
)

// Watch column order changes
watch(
  () => tableRef.value?.table?.getState()?.columnOrder,
  () => { if (prefsLoaded.value) persistCurrentPrefs() },
  { deep: true }
)

// ─── Expose ───────────────────────────────────────────────────────────────────
const getSelectedRows = () => tableRef.value?.getSelectedRows()
const reload          = () => tableRef.value?.reload()
const clearCache      = () => tableRef.value?.clearCache()
const exportTable     = (format, allPages, filteredRows) => tableRef.value?.exportTable(format, allPages, filteredRows)
const pinColumn       = (key, position) => tableRef.value?.pinColumn(key, position)

defineExpose({ getSelectedRows, reload, clearCache, exportTable, tableRef, closePreview, pinColumn })
</script>

<template>
  <div class="relative" ref="containerRef">

    <!-- Toolbar row (no card) -->
    <div class="flex flex-wrap items-center gap-2 mb-2">

      <!-- Search -->
      <div v-if="showSearch" class="flex-1 min-w-48 max-w-xs">
        <Forms.Input v-model="search" type="search" :placeholder="searchPlaceholder" :icon-left="IconSearch" size="sm" />
      </div>

      <!-- + Filtros button -->
      <div v-if="showFilters && hasFilterableColumns" ref="filterAddBtnRef" class="relative">
        <button
          type="button"
          @click="toggleFilterMenu"
          :class="[
            'inline-flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-lg border transition-colors',
            activeFilterList.length
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-card-line bg-card text-muted-foreground-1 hover:bg-muted-hover'
          ]"
        >
          <IconPlus class="size-3.5" />
          Filtros{{ activeFilterList.length ? ` (${activeFilterList.length})` : '' }}
        </button>
      </div>

      <!-- Slot for custom toolbar buttons -->
      <slot name="toolbar" />

      <!-- Secondary actions: pushed to the right, icon-only style -->
      <div class="ml-auto flex items-center gap-1">
        <button
          ref="columnButtonRef"
          type="button"
          @click="showColumnPanel = !showColumnPanel"
          :title="'Columnas'"
          :class="[
            'p-1.5 inline-flex items-center justify-center rounded-lg border transition-colors',
            showColumnPanel
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-transparent text-muted-foreground hover:border-card-line hover:bg-muted-hover hover:text-foreground'
          ]"
        >
          <IconLayoutColumns class="size-4" />
        </button>

        <TableExportable v-if="showExport" :table-ref="tableRef" :name="resolvedName" :columns="columns" />
      </div>
    </div>

    <!-- Filter chips row (shown when filters active) -->
    <div v-if="activeFilterList.length" class="flex flex-wrap items-center gap-1.5 mb-2">
      <div
        v-for="chip in activeFilterList"
        :key="chip.key"
        class="inline-flex items-center text-xs rounded-lg border border-card-line bg-card overflow-hidden"
      >
        <span class="px-2.5 py-1 text-foreground font-medium border-r border-card-line bg-surface">{{ chip.label }}</span>
        <span class="px-2 py-1 text-muted-foreground">{{ chip.displayOp }}</span>
        <button
          type="button"
          @click.stop="openEditFilter(chip.col)"
          class="inline-flex items-center gap-1 px-2 py-1 text-primary font-medium hover:bg-primary/10 transition-colors border-x border-card-line"
        >
          {{ chip.displayVal }}
          <IconChevronDown class="size-3 opacity-60" />
        </button>
        <button
          type="button"
          @click.stop="removeFilter(chip.key)"
          class="px-1.5 py-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <IconX class="size-3" />
        </button>
      </div>
    </div>

    <!-- Tabla -->
    <div class="overflow-hidden border-t border-b border-card-line">
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
        :pinned-columns="resolvedPinnedColumns"
        @row-click="handleRowClick"
        @loaded="handleLoaded"
        @page-change="closePreview"
        @per-page-change="closePreview"
      >
        <template v-for="(_, name) in forwardedSlots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps ?? {}" />
        </template>
      </Table>
    </div>

    <!-- Preview panel — overlay deslizante desde la derecha (cubre todo el componente) -->
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
        ref="previewPanelRef"
        class="absolute top-0 right-0 bottom-0 z-30 flex flex-col bg-card border border-card-line rounded-2xl shadow-xl overflow-hidden"
        :style="{ width: (100 - currentRatio) + '%' }"
      >
        <!-- Resize handle — thin pill on left edge -->
        <div
          class="absolute left-1 top-1/2 -translate-y-1/2 h-12 w-1 cursor-col-resize rounded-full bg-border hover:bg-primary/50 transition-colors z-10"
          @mousedown="startResize"
        />

        <!-- Barra de acciones del preview -->
        <div class="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-card-line">
          <!-- Título (reemplazable via slot) -->
          <div class="flex-1 min-w-0">
            <slot name="preview-header" :row="previewRow" :close="closePreview" />
          </div>

          <!-- Botones de acción — todos icon-only, mismo tamaño y estilo -->
          <div class="flex items-center gap-0.5 shrink-0">

            <!-- Acciones extra configurables desde el padre -->
            <slot name="preview-actions" :row="previewRow" :close="closePreview" />

            <!-- Abrir (configurable vía :preview-href) -->
            <div v-if="resolvedPreviewHref" class="hs-tooltip [--placement:top] inline-block">
              <NuxtLink
                :to="resolvedPreviewHref"
                class="hs-tooltip-toggle inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
              >
                <IconExternalLink class="size-3.5" />
              </NuxtLink>
              <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-tooltip border border-tooltip-line text-xs font-medium text-tooltip-foreground rounded-md shadow-2xs" role="tooltip">Abrir</span>
            </div>

            <!-- Eliminar (configurable vía :preview-deletable) -->
            <div v-if="previewDeletable" class="hs-tooltip [--placement:top] inline-block">
              <button
                type="button"
                class="hs-tooltip-toggle inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                @click.stop="emit('preview-delete', previewRow)"
              >
                <IconTrash class="size-3.5" />
              </button>
              <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-tooltip border border-tooltip-line text-xs font-medium text-tooltip-foreground rounded-md shadow-2xs" role="tooltip">Eliminar</span>
            </div>

            <!-- Minimizar (siempre) -->
            <div class="hs-tooltip [--placement:top] inline-block">
              <button
                type="button"
                class="hs-tooltip-toggle inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
                @click.stop="minimizePreview"
              >
                <IconMinus class="size-3.5" />
              </button>
              <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-tooltip border border-tooltip-line text-xs font-medium text-tooltip-foreground rounded-md shadow-2xs" role="tooltip">Minimizar</span>
            </div>

            <!-- Cerrar (siempre) -->
            <div class="hs-tooltip [--placement:top] inline-block">
              <button
                type="button"
                class="hs-tooltip-toggle inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
                @click.stop="closePreview"
              >
                <IconX class="size-3.5" />
              </button>
              <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-tooltip border border-tooltip-line text-xs font-medium text-tooltip-foreground rounded-md shadow-2xs" role="tooltip">Cerrar</span>
            </div>

          </div>
        </div>

        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <slot v-if="previewTab === 'datos'" name="preview" :row="previewRow" :close="closePreview" />
          <Table.PreviewTimeline
            v-else-if="previewTab === 'bitacora' && resolvedHistoryEndpoint"
            :endpoint="resolvedHistoryEndpoint"
          />
        </div>

        <!-- Tabs — bottom -->
        <div v-if="hasHistory" class="shrink-0 flex border-t border-card-line">
          <button
            type="button"
            @click="previewTab = 'datos'"
            :class="[
              'flex-1 py-2.5 text-xs font-semibold transition-colors border-r border-card-line border-t-2 -mt-px',
              previewTab === 'datos'
                ? 'border-t-card text-foreground'
                : 'border-t-transparent text-muted-foreground hover:text-foreground hover:bg-muted-hover'
            ]"
          >
            Datos
          </button>
          <button
            type="button"
            @click="resolvedHistoryEndpoint && (previewTab = 'bitacora')"
            :disabled="!resolvedHistoryEndpoint"
            :class="[
              'flex-1 py-2.5 text-xs font-semibold transition-colors border-t-2 -mt-px',
              !resolvedHistoryEndpoint
                ? 'border-t-transparent text-muted-foreground/40 cursor-not-allowed'
                : previewTab === 'bitacora'
                  ? 'border-t-card text-foreground'
                  : 'border-t-transparent text-muted-foreground hover:text-foreground hover:bg-muted-hover'
            ]"
          >
            Bitácora
          </button>
        </div>

      </div>
    </Transition>

    <!-- ── Floating mini-preview (dock expand, estilo Gmail) ── -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-4"
      >
        <div
          v-if="floatingItem"
          class="fixed z-[60] w-96 flex flex-col bg-card border border-card-line rounded-t-xl shadow-2xl overflow-hidden"
          :style="{ ...floatingPanelStyle, maxHeight: 'min(480px, calc(100vh - 60px))' }"
        >
          <div class="flex items-center gap-2 px-3 py-2.5 border-b border-card-line shrink-0 bg-surface select-none">
            <span class="size-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
              {{ (floatingItem.label?.[0] ?? '?').toUpperCase() }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-foreground truncate leading-tight">{{ floatingItem.label }}</p>
              <p v-if="floatingItem.subtitle" class="text-xs text-muted-foreground truncate">{{ floatingItem.subtitle }}</p>
            </div>
            <button type="button" title="Expandir" class="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors" @click.stop="expandToFull(floatingItem)">
              <IconMaximize class="size-3.5" />
            </button>
            <button type="button" title="Minimizar" class="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors" @click.stop="collapseDock()">
              <IconMinus class="size-3.5" />
            </button>
            <button type="button" title="Cerrar" class="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" @click.stop="undockItem(floatingItem.id)">
              <IconX class="size-3.5" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto min-h-0">
            <slot name="preview" :row="floatingItem.row" :close="() => undockItem(floatingItem.id)" />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Filter menu — teleported to body -->
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
          v-if="showFilterPanel"
          ref="filterMenuRef"
          class="fixed z-[60] bg-dropdown border border-dropdown-line rounded-xl shadow-2xl overflow-hidden"
          :style="filterMenuStyle"
        >

          <!-- Step 1: column picker -->
          <template v-if="filterMenuStep === 'columns'">
            <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pt-3 pb-1.5">
              Filtrar por
            </p>
            <div class="pb-2 min-w-48">
              <template v-if="availableFilterColumns.length">
                <button
                  v-for="col in availableFilterColumns"
                  :key="col.key"
                  type="button"
                  @click.stop="selectFilterColumn(col)"
                  class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted-hover transition-colors text-left group"
                >
                  <span>{{ col.label }}</span>
                  <span class="text-[11px] text-muted-foreground-2 group-hover:text-muted-foreground transition-colors capitalize">
                    {{ col.filterType === 'daterange' ? 'fecha' : col.filterType === 'select' ? 'opción' : 'texto' }}
                  </span>
                </button>
              </template>
              <p v-else class="px-3 py-3 text-xs text-muted-foreground italic">
                Todos los filtros están configurados
              </p>
            </div>
          </template>

          <!-- Step 2: value config -->
          <template v-else-if="filterMenuStep === 'value' && pendingCol">

            <!-- Header: back + field name + operator selector -->
            <div class="flex items-center gap-1.5 px-2 py-2 border-b border-dropdown-line">
              <button
                type="button"
                @click.stop="filterMenuStep = 'columns'"
                class="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors shrink-0"
              >
                <IconChevronLeft class="size-4" />
              </button>
              <span class="text-sm font-medium text-foreground">{{ pendingCol.label }}</span>

              <!-- Operator: native select for text (3 options) -->
              <select
                v-if="pendingCol.filterType === 'text'"
                v-model="pendingOperator"
                class="ml-auto text-xs bg-dropdown border border-dropdown-line rounded-md px-2 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
              >
                <option v-for="op in textOps" :key="op.value" :value="op.value">{{ op.label }}</option>
              </select>

              <!-- Operator: segmented toggle for select (es / no es) -->
              <div v-else-if="pendingCol.filterType === 'select'" class="ml-auto flex rounded-md border border-dropdown-line overflow-hidden text-xs">
                <button
                  v-for="op in selectOps"
                  :key="op.value"
                  type="button"
                  @click.stop="pendingOperator = op.value"
                  :class="[
                    'px-2.5 py-1 transition-colors',
                    pendingOperator === op.value
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted-hover'
                  ]"
                >
                  {{ op.label }}
                </button>
              </div>

              <!-- Operator: inline select for daterange -->
              <select
                v-else-if="pendingCol.filterType === 'daterange'"
                v-model="pendingDateOp"
                class="ml-auto text-xs bg-dropdown border border-dropdown-line rounded-md px-2 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
              >
                <option v-for="op in dateOps" :key="op.value" :value="op.value">{{ op.label }}</option>
              </select>
            </div>

            <div class="p-3 min-w-56 space-y-2">

              <!-- ── TEXT ── -->
              <input
                v-if="pendingCol.filterType === 'text'"
                ref="pendingValueInputRef"
                v-model="pendingValue"
                type="text"
                @keydown.enter.stop="applyPendingFilter"
                @keydown.escape.stop="closeFilterMenu"
                placeholder="Valor..."
                class="w-full rounded-lg border border-dropdown-line bg-card text-foreground py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary"
              />

              <!-- ── SELECT ── -->
              <div v-else-if="pendingCol.filterType === 'select'" class="space-y-0.5 max-h-52 overflow-y-auto -mx-1">
                <button
                  v-for="opt in pendingCol.filterOptions"
                  :key="opt.value"
                  type="button"
                  @click.stop="pendingValue = opt.value; applyPendingFilter()"
                  :class="[
                    'w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg transition-colors text-left',
                    pendingValue === opt.value
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted-hover text-foreground'
                  ]"
                >
                  <span class="flex-1">{{ opt.label }}</span>
                  <IconCheck v-if="pendingValue === opt.value" class="size-3.5 shrink-0 text-primary/70" />
                </button>
              </div>

              <!-- ── DATERANGE ── -->
              <template v-else-if="pendingCol.filterType === 'daterange'">
                <template v-if="pendingDateOp === 'between'">
                  <input type="date" v-model="pendingValue.from" class="w-full rounded-lg border border-dropdown-line bg-card text-foreground py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/60" />
                  <input type="date" v-model="pendingValue.to"   class="w-full rounded-lg border border-dropdown-line bg-card text-foreground py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/60" />
                </template>
                <input v-else type="date" v-model="pendingValue.singleDate" class="w-full rounded-lg border border-dropdown-line bg-card text-foreground py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/60" />
              </template>

              <!-- Apply (not for select — auto-applies on click) -->
              <button
                v-if="pendingCol.filterType !== 'select'"
                type="button"
                @click.stop="applyPendingFilter"
                class="w-full py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 active:bg-primary/80 transition-colors"
              >
                Aplicar
              </button>

            </div>
          </template>

        </div>
      </Transition>
    </Teleport>

    <!-- Column panel — teleported to body to escape overflow-hidden -->
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
          class="fixed z-50 bg-dropdown border border-dropdown-line rounded-xl shadow-2xl min-w-64 max-h-[480px] overflow-y-auto"
          :style="columnPanelStyle"
        >

          <!-- ── Sección: Fija a la izquierda ── -->
          <div class="p-2 pb-1">
            <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1.5 flex items-center gap-1.5">
              <span class="size-1.5 rounded-full bg-indigo-400 inline-block"></span>
              Fija a la izquierda
            </p>
            <div
              class="rounded-lg min-h-[34px] transition-colors"
              :class="dragOverSection === 'left' && draggedKey && !columnsBySection.left.find(c => c.key === draggedKey)
                ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-300 dark:ring-indigo-700'
                : columnsBySection.left.length === 0 ? 'border border-dashed border-card-line' : ''"
              @dragover.prevent="dragOverSection = 'left'"
              @dragleave="dragOverSection = null"
              @drop.stop="onDropSection('left')"
            >
              <p v-if="columnsBySection.left.length === 0" class="flex items-center justify-center h-[34px] text-xs text-muted-foreground-2 italic select-none">
                Arrastra columnas aquí
              </p>
              <div
                v-for="col in columnsBySection.left"
                :key="col.key"
                draggable="true"
                @dragstart="onDragStart(col.key, 'left')"
                @dragover.prevent="dragOverSection = 'left'; dragOverKey = col.key"
                @dragleave="dragOverKey = null"
                @drop.stop="onDrop(col.key, 'left')"
                class="flex items-center gap-2 py-1.5 px-2 rounded-lg select-none cursor-grab transition-colors"
                :class="dragOverKey === col.key ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-muted-hover'"
              >
                <IconGripVertical class="size-4 text-muted-foreground-2 shrink-0" />
                <input
                  type="checkbox"
                  :checked="tableRef?.table.getColumn(col.key)?.getIsVisible() ?? true"
                  @change="tableRef?.table.getColumn(col.key)?.toggleVisibility(); persistCurrentPrefs()"
                  @click.stop
                  class="rounded border-card-line bg-surface shrink-0 cursor-pointer"
                />
                <span class="text-sm text-foreground truncate flex-1">{{ col.label }}</span>
                <span class="size-1.5 rounded-full bg-indigo-400 shrink-0 opacity-60" />
              </div>
            </div>
          </div>

          <div class="mx-3 border-t border-dropdown-line" />

          <!-- ── Sección: Columnas libres ── -->
          <div class="p-2 py-1">
            <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1.5 flex items-center gap-1.5">
              <span class="size-1.5 rounded-full bg-muted-foreground-2 inline-block"></span>
              Columnas
            </p>
            <div
              class="rounded-lg min-h-[34px] transition-colors"
              :class="dragOverSection === 'center' && draggedKey && !columnsBySection.center.find(c => c.key === draggedKey)
                ? 'bg-muted/60 ring-1 ring-border'
                : ''"
              @dragover.prevent="dragOverSection = 'center'"
              @dragleave="dragOverSection = null"
              @drop.stop="onDropSection('center')"
            >
              <p v-if="columnsBySection.center.length === 0" class="flex items-center justify-center h-[34px] text-xs text-muted-foreground-2 italic select-none">
                Sin columnas libres
              </p>
              <div
                v-for="col in columnsBySection.center"
                :key="col.key"
                draggable="true"
                @dragstart="onDragStart(col.key, 'center')"
                @dragover.prevent="dragOverSection = 'center'; dragOverKey = col.key"
                @dragleave="dragOverKey = null"
                @drop.stop="onDrop(col.key, 'center')"
                class="flex items-center gap-2 py-1.5 px-2 rounded-lg select-none cursor-grab transition-colors"
                :class="dragOverKey === col.key ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-700' : 'hover:bg-muted-hover'"
              >
                <IconGripVertical class="size-4 text-muted-foreground-2 shrink-0" />
                <input
                  type="checkbox"
                  :checked="tableRef?.table.getColumn(col.key)?.getIsVisible() ?? true"
                  @change="tableRef?.table.getColumn(col.key)?.toggleVisibility(); persistCurrentPrefs()"
                  @click.stop
                  class="rounded border-card-line bg-surface shrink-0 cursor-pointer"
                />
                <span class="text-sm text-foreground truncate flex-1">{{ col.label }}</span>
              </div>
            </div>
          </div>

          <div class="mx-3 border-t border-dropdown-line" />

          <!-- ── Sección: Fija a la derecha ── -->
          <div class="p-2 pt-1">
            <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1.5 flex items-center gap-1.5">
              <span class="size-1.5 rounded-full bg-amber-400 inline-block"></span>
              Fija a la derecha
            </p>
            <div
              class="rounded-lg min-h-[34px] transition-colors"
              :class="dragOverSection === 'right' && draggedKey && !columnsBySection.right.find(c => c.key === draggedKey)
                ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-700'
                : columnsBySection.right.length === 0 ? 'border border-dashed border-card-line' : ''"
              @dragover.prevent="dragOverSection = 'right'"
              @dragleave="dragOverSection = null"
              @drop.stop="onDropSection('right')"
            >
              <p v-if="columnsBySection.right.length === 0" class="flex items-center justify-center h-[34px] text-xs text-muted-foreground-2 italic select-none">
                Arrastra columnas aquí
              </p>
              <div
                v-for="col in columnsBySection.right"
                :key="col.key"
                draggable="true"
                @dragstart="onDragStart(col.key, 'right')"
                @dragover.prevent="dragOverSection = 'right'; dragOverKey = col.key"
                @dragleave="dragOverKey = null"
                @drop.stop="onDrop(col.key, 'right')"
                class="flex items-center gap-2 py-1.5 px-2 rounded-lg select-none cursor-grab transition-colors"
                :class="dragOverKey === col.key ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-muted-hover'"
              >
                <IconGripVertical class="size-4 text-muted-foreground-2 shrink-0" />
                <input
                  type="checkbox"
                  :checked="tableRef?.table.getColumn(col.key)?.getIsVisible() ?? true"
                  @change="tableRef?.table.getColumn(col.key)?.toggleVisibility(); persistCurrentPrefs()"
                  @click.stop
                  class="rounded border-card-line bg-surface shrink-0 cursor-pointer"
                />
                <span class="text-sm text-foreground truncate flex-1">{{ col.label }}</span>
                <span class="size-1.5 rounded-full bg-amber-400 shrink-0 opacity-60" />
              </div>
            </div>
          </div>

        </div>
      </Transition>
    </Teleport>
  </div>
</template>
