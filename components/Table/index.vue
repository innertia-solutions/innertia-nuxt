<script setup>
import { useVueTable, getCoreRowModel } from '@tanstack/vue-table'
import {
  IconSelector,
  IconChevronUp,
  IconChevronDown,
  IconReload,
  IconBolt,
  IconPin,
} from '@tabler/icons-vue'

const props = defineProps({
  endpoint: { type: String, required: true },
  columns: { type: Array, required: true }, // [{ key, label, sortable?, filterable?, class? }]
  params: { type: Object, default: () => ({}) },
  checkable: { type: Boolean, default: false },
  search: { type: String, default: '' },
  name: { type: String, required: true },
  cached: { type: Boolean, default: false },
  showReloadButton: { type: Boolean, default: true },
  viewMode: { type: String, default: 'table' }, // 'table' | 'grid'
  gridClass: { type: String, default: 'grid grid-cols-2 lg:grid-cols-3 gap-4' },
  clickRowToOpen:  { type: Boolean, default: false },
  previewRowId:    { type: [String, Number], default: null },
  previewMode:     { type: Boolean, default: false },
  pinnedColumns:   { type: Object, default: null }, // { left?: string[], right?: string[] }
})

const emit = defineEmits(['update:search', 'row-click', 'loaded', 'page-change', 'per-page-change'])
const instance = getCurrentInstance()

// ─── API / toast ─────────────────────────────────────────────────────────────
const api = useApi()
const toast = useToast()

// ─── Local data ───────────────────────────────────────────────────────────────
const tableData = ref([])
const rowCount = ref(0)
const loading = ref(false)
const isDataFromCache = ref(false)
const lastDataLength = ref(-1)
const lastRowHeight = ref(48)
const tableBodyRef = ref(null)
const paginationBarRef = ref(null)
const skeletonRows = computed(() => {
  const count = lastDataLength.value < 0 ? pagination.value.pageSize : lastDataLength.value
  return Array.from({ length: count })
})
const isGridView = computed(() => props.viewMode === 'grid')

// ─── TanStack state ───────────────────────────────────────────────────────────
const pagination = ref({ pageIndex: 0, pageSize: 10 })
const sorting = ref([])
const columnFilters = ref([])
const columnVisibility = ref({})
const columnOrder = ref([])
const columnSizing = ref({})
const columnSizingInfo = ref({})
const rowSelection = ref({})
const columnPinning = ref({ left: [], right: [] })
const isCustomPerPage = ref(false)

const makeUpdater = (stateRef) => (updater) => {
  stateRef.value = typeof updater === 'function' ? updater(stateRef.value) : updater
}

// ─── Column definitions ───────────────────────────────────────────────────────
const buildColumnDefs = () => {
  const defs = []
  if (props.checkable) {
    defs.push({
      id: 'select',
      header: 'select',
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false,
      size: 48,
      minSize: 48,
      maxSize: 48,
    })
  }
  for (const col of props.columns) {
    defs.push({
      id: col.key,
      accessorKey: col.key,
      header: col.label,
      enableSorting: col.sortable ?? false,
      enableColumnFilter: col.filterable ?? false,
      enableResizing: col.resizable !== false,
      size: col.size ?? 200,
      minSize: 60,
      maxSize: 800,
      meta: { class: col.class ?? '', label: col.label },
    })
  }
  return defs
}

const columnDefs = buildColumnDefs()

const hasFilterableColumns = computed(() => props.columns.some(c => c.filterable))

// ─── TanStack table instance ──────────────────────────────────────────────────
const table = useVueTable({
  get data() { return tableData.value },
  get rowCount() { return rowCount.value },
  columns: columnDefs,
  state: {
    get pagination() { return pagination.value },
    get sorting() { return sorting.value },
    get columnFilters() { return columnFilters.value },
    get columnVisibility() { return columnVisibility.value },
    get columnOrder() { return columnOrder.value },
    get columnSizing() { return columnSizing.value },
    get columnSizingInfo() { return columnSizingInfo.value },
    get rowSelection() { return rowSelection.value },
    get columnPinning() { return columnPinning.value },
  },
  onPaginationChange: makeUpdater(pagination),
  onSortingChange: makeUpdater(sorting),
  onColumnFiltersChange: makeUpdater(columnFilters),
  onColumnVisibilityChange: makeUpdater(columnVisibility),
  onColumnOrderChange: makeUpdater(columnOrder),
  onColumnSizingChange: makeUpdater(columnSizing),
  onColumnSizingInfoChange: makeUpdater(columnSizingInfo),
  onRowSelectionChange: makeUpdater(rowSelection),
  onColumnPinningChange: makeUpdater(columnPinning),
  getCoreRowModel: getCoreRowModel(),
  columnResizeMode: 'onChange',
  enableColumnResizing: true,
  enableColumnPinning: true,
  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
  enableMultiSort: true,
  enableSortingRemoval: true,
  enableRowSelection: true,
})

// ─── Column pinning helpers ───────────────────────────────────────────────────
const pinColumn = (key, position) => {
  table.getColumn(key)?.pin(position)
}

const getPinnedStyles = (column, isHeader = false) => {
  const pinned = column.getIsPinned()
  if (!pinned) return {}
  const z = isHeader ? 2 : 1
  const w = column.getSize() + 'px'
  // Headers always use the solid card background.
  // Body cells use --row-bg, which is set to solid colors only (normal + hover) via <style scoped>.
  // Selected/preview rows intentionally don't set --row-bg so sticky cells fall back to --card,
  // which prevents semi-transparent tints from bleeding through the sticky cell.
  const bg = isHeader ? 'var(--card, #fff)' : 'var(--row-bg, var(--card, #fff))'
  const base = {
    position: 'sticky',
    zIndex: z,
    background: bg,
    width: w,
    minWidth: w,
    maxWidth: w,
  }
  // inset box-shadow: paints inside the cell so it can't be covered by adjacent cells
  // and always follows the visual sticky position (unlike border or outset box-shadow)
  if (pinned === 'left') return { ...base, left: column.getStart('left') + 'px', boxShadow: 'inset -1px 0 0 0 var(--card-line, #e5e7eb)' }
  if (pinned === 'right') return { ...base, right: column.getAfter('right') + 'px', boxShadow: 'inset 1px 0 0 0 var(--card-line, #e5e7eb)' }
  return {}
}


// Initialize pinning from prop if provided
onMounted(() => {
  if (props.pinnedColumns) {
    columnPinning.value = {
      left: props.pinnedColumns.left ?? [],
      right: props.pinnedColumns.right ?? [],
    }
  }
})

// Keep 'select' always first in the left pinning array.
// Fires synchronously so the colgroup/headers never render in wrong order.
watch(() => columnPinning.value.left, (left) => {
  if (props.checkable && left.includes('select') && left[0] !== 'select') {
    columnPinning.value = {
      ...columnPinning.value,
      left: ['select', ...left.filter(id => id !== 'select')],
    }
  }
}, { flush: 'sync' })

// ─── Fetch ────────────────────────────────────────────────────────────────────
const buildRequestParams = () => {
  const { sort, ...otherParams } = props.params
  return {
    search: props.search,
    page: pagination.value.pageIndex + 1,
    perPage: pagination.value.pageSize,
    sortColumns: sorting.value.map(s => ({ column: s.id, direction: s.desc ? 'desc' : 'asc' })),
    columnFilters: Object.fromEntries(columnFilters.value.map(f => [f.id, f.value])),
    ...otherParams,
  }
}

const fetchData = async () => {
  if (tableData.value.length > 0) {
    lastDataLength.value = tableData.value.length
  }

  tableData.value = []
  loading.value = true
  isDataFromCache.value = false

  try {
    const res = await api.get(props.endpoint, { params: buildRequestParams() })
    if (!res) return

    tableData.value = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])
    const m = res.meta ?? (res.current_page !== undefined ? res : null)
    rowCount.value = m?.total ?? tableData.value.length

    if (props.cached) saveToCache()
    emit('loaded', res)
  } catch (e) {
    console.error('[FullTable] Fetch error:', e)
  } finally {
    loading.value = false
  }
}

// ─── Scheduled fetch (deduplicates concurrent state changes) ─────────────────
let fetchTimeout = null
const scheduleFetch = (delay = 0) => {
  if (fetchTimeout) clearTimeout(fetchTimeout)
  fetchTimeout = setTimeout(() => fetchData(), delay)
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const cacheKey = computed(() => {
  if (!props.cached || !props.name) return null
  const base = `full_table_${props.name}`
  if (!Object.keys(props.params).length) return base
  try { return base + '_' + btoa(JSON.stringify(props.params)) } catch { return base }
})

const saveToCache = () => {
  if (!cacheKey.value || !tableData.value.length) return
  try {
    sessionStorage.setItem(cacheKey.value, JSON.stringify({
      data: tableData.value,
      rowCount: rowCount.value,
      pagination: pagination.value,
      sorting: sorting.value,
      columnFilters: columnFilters.value,
      columnVisibility: columnVisibility.value,
      columnOrder: columnOrder.value,
      search: props.search,
      timestamp: Date.now(),
    }))
  } catch (e) {
    console.warn('[FullTable] Cache save error:', e)
  }
}

const loadFromCache = () => {
  if (!cacheKey.value) return null
  try {
    const raw = sessionStorage.getItem(cacheKey.value)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (Date.now() - cached.timestamp > 10 * 60 * 1000) {
      sessionStorage.removeItem(cacheKey.value)
      return null
    }
    if (cached.search !== props.search) return null
    return cached
  } catch { return null }
}

const clearCache = () => {
  if (cacheKey.value) sessionStorage.removeItem(cacheKey.value)
}

// ─── Restore guard (prevents watchers from triggering fetch during restore) ───
const isRestoring = ref(false)

const loadFromCacheOnMount = async () => {
  const cached = loadFromCache()
  if (!cached) return false

  isRestoring.value = true
  tableData.value = cached.data
  rowCount.value = cached.rowCount
  pagination.value = cached.pagination
  sorting.value = cached.sorting
  columnFilters.value = cached.columnFilters
  columnVisibility.value = cached.columnVisibility
  if (cached.columnOrder?.length) {
    const order = cached.columnOrder.filter(id => id !== 'select')
    if (props.checkable) order.unshift('select')
    columnOrder.value = order
  }
  lastDataLength.value = cached.data.length
  isDataFromCache.value = true

  if (cached.search !== props.search) emit('update:search', cached.search)

  await nextTick()
  isRestoring.value = false
  return true
}

// ─── Watchers ─────────────────────────────────────────────────────────────────
watch(tableData, (newData) => {
  if (newData.length > 0 && tableBodyRef.value) {
    const firstDataRow = Array.from(tableBodyRef.value.children).find(el => el.dataset.rowType === 'data')
    if (firstDataRow) {
      const h = firstDataRow.getBoundingClientRect().height
      if (h > 0) lastRowHeight.value = h
      lastDataLength.value = newData.length
    }
  }
}, { flush: 'post' })

watch(pagination, () => { if (!isRestoring.value) scheduleFetch(0) }, { deep: true })

watch(() => pagination.value.pageIndex, (val, old) => {
  if (!isRestoring.value && val !== old) emit('page-change', val)
})
watch(() => pagination.value.pageSize, (val, old) => {
  if (!isRestoring.value && val !== old) emit('per-page-change', val)
})
watch(sorting, () => { if (!isRestoring.value) scheduleFetch(0) }, { deep: true })
watch(columnFilters, () => { if (!isRestoring.value) scheduleFetch(300) }, { deep: true })

watch(() => props.search, () => {
  if (isRestoring.value) return
  pagination.value = { ...pagination.value, pageIndex: 0 }
  scheduleFetch(500)
})

watch(() => props.params, () => {
  if (isRestoring.value) return
  pagination.value = { ...pagination.value, pageIndex: 0 }
  scheduleFetch(0)
}, { deep: true })

// ─── Lifecycle ────────────────────────────────────────────────────────────────
const initColumnOrder = () => {
  const ids = props.checkable ? ['select'] : []
  for (const col of props.columns) ids.push(col.key)
  columnOrder.value = ids
}

onMounted(async () => {
  initColumnOrder()
  try {
    const fromCache = await loadFromCacheOnMount()
    if (!fromCache) await fetchData()
  } catch (e) {
    console.error('[FullTable] Mount error:', e)
  }
})

onBeforeUnmount(() => {
  if (fetchTimeout) clearTimeout(fetchTimeout)
  if (props.cached && tableData.value.length > 0) saveToCache()
})

// ─── Column settings panel ────────────────────────────────────────────────────
const setColumnOrder = (order) => { columnOrder.value = order }

// ─── Header drag reorder ──────────────────────────────────────────────────────
let draggedHeaderId = null
const dragOverHeaderId = ref(null)
const resizeHoverId = ref(null)

// ─── Column auto-size on double click ─────────────────────────────────────────
const _canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
const _ctx = _canvas?.getContext('2d')

const measureText = (text, font) => {
  if (!_ctx) return 0
  _ctx.font = font
  return _ctx.measureText(String(text ?? '')).width
}

const autoSizeColumn = (header) => {
  const colId = header.column.id
  const pad = 32

  const label = header.column.columnDef.meta?.label ?? header.id
  let max = measureText(label, '500 12px ui-sans-serif,system-ui,sans-serif') + pad + 20

  if (tableBodyRef.value) {
    tableBodyRef.value.querySelectorAll(`td[data-col-id="${colId}"]`).forEach(td => {
      const w = measureText(td.textContent?.trim(), '14px ui-sans-serif,system-ui,sans-serif') + pad
      if (w > max) max = w
    })
  }

  table.setColumnSizing(prev => ({ ...prev, [colId]: Math.ceil(max) }))
}

const onHeaderDragStart = (colId) => { draggedHeaderId = colId }
const onHeaderDragOver = (e, colId) => { e.preventDefault(); dragOverHeaderId.value = colId }
const onHeaderDragLeave = () => { dragOverHeaderId.value = null }
const onHeaderDrop = (colId) => {
  if (!draggedHeaderId || draggedHeaderId === colId) return
  if (colId === 'select') return
  const order = [...columnOrder.value]
  const from = order.indexOf(draggedHeaderId)
  const to = order.indexOf(colId)
  if (from < 0 || to < 0) return
  order.splice(from, 1)
  order.splice(to, 0, draggedHeaderId)
  // keep 'select' pinned first
  const selIdx = order.indexOf('select')
  if (selIdx > 0) { order.splice(selIdx, 1); order.unshift('select') }
  columnOrder.value = order
  draggedHeaderId = null
  dragOverHeaderId.value = null
}

// ─── Row selection ────────────────────────────────────────────────────────────
const getSelectedRows = () => {
  const selected = table.getSelectedRowModel().rows.map(r => r.original)
  return table.getIsAllRowsSelected()
    ? { meta: { all: true }, rows: [] }
    : { meta: { all: false }, rows: selected }
}

// ─── Export ───────────────────────────────────────────────────────────────────
const exportTable = async (format, exportAllPages, exportFilteredRows, selectedIds = null) => {
  const { download } = useDownload()
  const id = crypto.randomUUID()
  toast.show({
    id, type: 'process', title: 'Descargando archivo...',
    progress: 0, progressLabel: 'Iniciando descarga', message: '', position: 'top-right',
  })

  const validFormats = ['csv', 'xlsx', 'pdf', 'json']
  const params = {
    ...buildRequestParams(),
    exportType: validFormats.includes(format) ? format : 'csv',
    exportAllPages,
    exportFilteredRows,
    ...(selectedIds?.length ? { selectedIds } : {}),
  }

  try {
    const { blob, headers } = await download(props.endpoint, params, {
      method: 'GET',
      onProgress: (p) => toast.update(id, { progress: p, progressLabel: `Descargando... ${p}%` }),
    })

    let fileName = 'export.' + format
    const cd = headers['content-disposition']
    if (cd) {
      const m = cd.match(/filename="(.+)"/)
      if (m?.[1]) fileName = m[1]
    }

    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.setAttribute('download', fileName)
    document.body.appendChild(a); a.click(); a.remove()
    window.URL.revokeObjectURL(url)

    toast.update(id, { progress: 100, progressLabel: '¡Descarga completada!', message: 'El archivo se descargó correctamente.' })
    setTimeout(() => toast.remove(id), 2000)
  } catch (e) {
    toast.update(id, { progressLabel: 'Error en la descarga', message: e.message, severity: 'danger' })
    setTimeout(() => toast.remove(id), 3000)
  }
}

// ─── Per-page ─────────────────────────────────────────────────────────────────
const handlePerPageChange = (val) => {
  if (val === 'custom') { isCustomPerPage.value = true; return }
  table.setPageSize(parseInt(val))
}

const resetPerPage = () => {
  isCustomPerPage.value = false
  if (![10, 25, 50, 100].includes(pagination.value.pageSize)) table.setPageSize(10)
}

// ─── Row click ────────────────────────────────────────────────────────────────
const hasRowClickListener = computed(() => !!instance?.vnode?.props?.onRowClick)
const isRowClickEnabled = computed(() => props.clickRowToOpen || props.previewMode || hasRowClickListener.value)

const interactiveSelector = [
  'a', 'button', 'input', 'select', 'textarea', 'label', 'summary',
  "[role='button']", "[role='link']", "[contenteditable='true']",
  '[data-row-click-ignore]', '[data-no-row-click]', '.hs-dropdown', '.dropdown',
].join(',')

const shouldIgnoreRowClick = (e) => {
  const t = e?.target
  if (!(t instanceof Element)) return false
  const el = t.closest(interactiveSelector)
  return !!el && e.currentTarget?.contains(el)
}

const handleRowClick = (row, e) => {
  if (!isRowClickEnabled.value || shouldIgnoreRowClick(e)) return
  emit('row-click', row.original, e)
}

const handleRowKeydown = (row, e) => {
  if (!isRowClickEnabled.value || shouldIgnoreRowClick(e)) return
  if (!['Enter', ' '].includes(e.key)) return
  e.preventDefault()
  emit('row-click', row.original, e)
}

// Compute --row-bg for pinned (sticky) cells.
// Non-pinned cells get background from Tailwind classes on <tr>.
// Pinned cells inherit --row-bg which must be a solid opaque color (no transparency → no bleed-through).
// color-mix() blends the Tailwind tint with the card color to produce an opaque equivalent.
// For normal/hover rows the <style scoped> CSS rule handles it; selected/preview override via inline style.
const pinnedRowStyle = (row) => {
  if (props.previewRowId && row.original.id === props.previewRowId) {
    // !bg-indigo-50 → solid indigo-50
    return { '--row-bg': 'color-mix(in srgb, #eef2ff 100%, var(--card, #fff))' }
  }
  if (row.getIsSelected()) {
    // bg-indigo-50/40 → 40% indigo-50 blended with card
    return { '--row-bg': 'color-mix(in srgb, #eef2ff 40%, var(--card, #fff))' }
  }
  return {}
}

// ─── Expose ───────────────────────────────────────────────────────────────────
const reloadTable = () => {
  clearCache()
  isDataFromCache.value = false
  fetchData()
}

defineExpose({
  getSelectedRows,
  loading,
  exportTable,
  reload: reloadTable,
  clearCache,
  table,
  setColumnOrder,
  isDataFromCache,
  cached: computed(() => props.cached),
  paginationBarRef,
  columnPinning,
  pinColumn,
})
</script>

<template>
  <div class="relative">

    <!-- Table view -->
    <div v-if="!isGridView" class="overflow-x-auto relative">
      <table
        class="relative divide-y divide-card-line"
        :style="{ tableLayout: 'fixed', width: table.getTotalSize() + 'px', minWidth: '100%' }"
      >
        <colgroup>
          <!-- Must use pinning order (left|center|right) — same as getHeaderGroups() and row.getVisibleCells() -->
          <col
            v-for="col in [...table.getLeftVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns(), ...table.getRightVisibleLeafColumns()]"
            :key="col.id"
            :style="{ width: col.getSize() + 'px' }"
          >
        </colgroup>
        <thead class="relative z-20 bg-card">
          <template v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <!-- Main header row -->
            <tr class="bg-card">
              <th
                v-for="header in headerGroup.headers"
                :key="header.id"
                scope="col"
                :draggable="header.id !== 'select' && resizeHoverId !== header.id && !header.column.getIsPinned()"
                @dragstart="header.id !== 'select' && resizeHoverId !== header.id && !header.column.getIsPinned() && onHeaderDragStart(header.id)"
                @dragover="header.id !== 'select' && onHeaderDragOver($event, header.id)"
                @dragleave="onHeaderDragLeave"
                @drop="header.id !== 'select' && onHeaderDrop(header.id)"
                class="relative"
                :class="[
                  header.id === 'select' ? 'text-center' : '',
                  dragOverHeaderId === header.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : '',
                  header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                ]"
                :style="getPinnedStyles(header.column, true)"
                @click="header.column.getCanSort() && header.column.toggleSorting()"
              >
                <!-- Select all checkbox -->
                <template v-if="header.id === 'select'">
                  <input
                    type="checkbox"
                    :checked="table.getIsAllRowsSelected()"
                    :indeterminate="table.getIsSomeRowsSelected()"
                    @change="table.getToggleAllRowsSelectedHandler()($event)"
                    class="mx-2 shrink-0 border-card-line rounded-control text-blue-900 focus:ring-0 focus:ring-offset-0 dark:bg-card"
                  />
                </template>
                <!-- Regular column header -->
                <template v-else>
                  <div
                    class="px-4 py-3 flex items-center gap-x-1 text-xs font-medium w-full overflow-hidden"
                    :class="header.column.getIsPinned() ? 'text-foreground' : 'text-muted-foreground'"
                  >
                    <IconPin v-if="header.column.getIsPinned()" class="size-3 shrink-0 text-indigo-400 dark:text-indigo-500" />
                    <span class="truncate">{{ header.column.columnDef.meta?.label ?? header.id }}</span>
                    <span v-if="header.column.getCanSort()">
                      <IconSelector v-if="!header.column.getIsSorted()" class="size-4 opacity-40" />
                      <IconChevronDown v-else-if="header.column.getIsSorted() === 'desc'" class="size-4" />
                      <IconChevronUp v-else class="size-4" />
                    </span>
                  </div>
                  <!-- Resize handle -->
                  <div
                    v-if="header.column.getCanResize()"
                    class="absolute right-0 top-0 h-full w-3 cursor-col-resize group/rz flex items-center justify-center select-none touch-none"
                    @mouseenter="resizeHoverId = header.id"
                    @mouseleave="resizeHoverId = null"
                    @mousedown.stop="header.getResizeHandler()?.($event)"
                    @touchstart.passive.stop="header.getResizeHandler()?.($event)"
                    @dblclick.stop="autoSizeColumn(header)"
                    @dragstart.stop.prevent
                    @click.stop
                  >
                    <div
                      class="h-4 w-px transition-all"
                      :class="header.column.getIsResizing()
                        ? 'bg-indigo-400 dark:bg-indigo-500 !w-0.5'
                        : 'bg-surface-1 group-hover/rz:bg-indigo-300 dark:group-hover/rz:bg-indigo-600 group-hover/rz:w-0.5'"
                    />
                  </div>
                </template>
              </th>
            </tr>

            <!-- Column filter row -->
            <tr
              v-if="hasFilterableColumns"
              class="border-b border-card-line bg-muted/50"
            >
              <th
                v-for="header in headerGroup.headers"
                :key="'f-' + header.id"
                :class="[
                  header.id === 'select' ? 'w-12' : 'px-3 py-1.5',
                ]"
                :style="getPinnedStyles(header.column, true)"
              >
                <input
                  v-if="header.column.getCanFilter()"
                  :value="header.column.getFilterValue() ?? ''"
                  @input="(e) => header.column.setFilterValue(e.target.value || undefined)"
                  :placeholder="`Filtrar ${header.column.columnDef.meta?.label ?? ''}...`"
                  class="w-full bg-card border border-card-line rounded-control text-xs text-muted-foreground-1 px-2.5 py-1 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500 outline-none transition-all"
                />
              </th>
            </tr>
          </template>
        </thead>

        <tbody ref="tableBodyRef" class="divide-y divide-card-line">
          <!-- Loading skeleton rows -->
          <tr
            v-if="loading"
            v-for="(_, i) in skeletonRows"
            :key="'sk-' + i"
            class="animate-pulse bg-card"
          >
            <td
              v-for="header in (table.getHeaderGroups()[0]?.headers ?? [])"
              :key="'skc-' + header.id"
              :class="[
                header.id === 'select' ? 'text-center w-12' : 'px-4 overflow-hidden',
              ]"
              :style="{ height: lastRowHeight + 'px', ...getPinnedStyles(header.column) }"
            >
              <div v-if="header.id === 'select'" class="w-4 h-4 bg-surface-1 rounded mx-auto"></div>
              <div v-else class="h-4 w-[50%] rounded bg-surface-1"></div>
            </td>
          </tr>

          <!-- Loading filler rows: pad to pageSize so table height doesn't change -->
          <tr
            v-if="loading && skeletonRows.length < pagination.pageSize"
            v-for="i in (pagination.pageSize - skeletonRows.length)"
            :key="'lf-' + i"
            class="bg-card"
          >
            <td
              v-for="header in (table.getHeaderGroups()[0]?.headers ?? [])"
              :key="'lfc-' + header.id"
              :style="{ height: lastRowHeight + 'px', ...getPinnedStyles(header.column) }"
            />
          </tr>

          <!-- Empty filler rows: maintain table height when no results -->
          <tr
            v-if="!loading && tableData.length === 0"
            v-for="i in pagination.pageSize"
            :key="'esk-' + i"
            class="bg-card"
          >
            <td
              v-for="header in (table.getHeaderGroups()[0]?.headers ?? [])"
              :key="'eskc-' + header.id"
              :style="{ height: lastRowHeight + 'px', ...getPinnedStyles(header.column) }"
            />
          </tr>

          <!-- Data rows -->
          <tr
            v-else
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            data-row-type="data"
            @click="(e) => handleRowClick(row, e)"
            @keydown="(e) => handleRowKeydown(row, e)"
            :tabindex="isRowClickEnabled ? 0 : undefined"
            class="bg-card hover:bg-layer-hover transition-colors"
            :class="{
              'cursor-pointer': isRowClickEnabled,
              'bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-indigo-50/60': row.getIsSelected(),
              '!bg-indigo-50 dark:!bg-indigo-900/20 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-700': previewRowId && row.original.id === previewRowId,
            }"
            :style="pinnedRowStyle(row)"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              :data-col-id="cell.column.id"
              :class="[
                cell.column.id === 'select'
                  ? 'text-center w-12 overflow-hidden'
                  : 'px-4 py-3 text-sm text-muted-foreground-1 overflow-hidden',
                cell.column.id !== 'select' ? cell.column.columnDef.meta?.class ?? '' : '',
              ]"
              :style="getPinnedStyles(cell.column)"
            >
              <!-- Select checkbox -->
              <template v-if="cell.column.id === 'select'">
                <div @click.stop>
                  <input
                    type="checkbox"
                    :checked="row.getIsSelected()"
                    :disabled="!row.getCanSelect()"
                    @change="row.getToggleSelectedHandler()($event)"
                    class="rounded border-card-line focus:ring-0 focus:ring-offset-0 dark:bg-card"
                  />
                </div>
              </template>
              <!-- Data cell with slot -->
              <template v-else>
                <slot :name="cell.column.id" :row="row.original" :value="cell.getValue()">
                  {{ cell.getValue() }}
                </slot>
              </template>
            </td>
          </tr>

          <!-- Filler rows: pad table to full page height when data < perPage -->
          <tr
            v-if="!loading && tableData.length > 0 && tableData.length < pagination.pageSize"
            v-for="i in (pagination.pageSize - tableData.length)"
            :key="'fill-' + i"
            class="bg-card"
          >
            <td
              v-for="header in (table.getHeaderGroups()[0]?.headers ?? [])"
              :key="'fillc-' + header.id"
              :style="{ height: lastRowHeight + 'px', ...getPinnedStyles(header.column) }"
            />
          </tr>
        </tbody>
      </table>

      <!-- Empty state overlays -->
      <div
        v-if="!loading && tableData.length === 0 && !search && !columnFilters.length"
        class="absolute inset-0 z-10 pointer-events-none flex items-center justify-center backdrop-blur-sm bg-card/60 rounded-card"
      >
        <slot name="empty">
          <p class="text-muted-foreground text-lg font-medium italic">No hay registros</p>
        </slot>
      </div>

      <div
        v-if="!loading && tableData.length === 0 && (search || columnFilters.length)"
        class="absolute inset-0 z-10 pointer-events-none flex items-center justify-center backdrop-blur-sm bg-card/60 rounded-card"
      >
        <slot name="empty-search">
          <p class="text-muted-foreground text-lg font-medium italic">No hay registros en la búsqueda</p>
        </slot>
      </div>
    </div>

    <!-- Grid view -->
    <div v-else class="relative">
      <div v-if="loading" :class="gridClass">
        <div v-for="(_, i) in skeletonRows" :key="'gsk-' + i" class="animate-pulse">
          <slot name="grid-skeleton">
            <div class="bg-card rounded-card border border-card-line p-4">
              <div class="space-y-3">
                <div class="h-4 bg-surface-1 rounded w-3/4"></div>
                <div class="h-4 bg-surface-1 rounded w-1/2"></div>
                <div class="h-6 bg-surface-1 rounded w-1/4"></div>
              </div>
            </div>
          </slot>
        </div>
      </div>

      <div v-else-if="tableData.length > 0" :class="gridClass">
        <slot
          name="grid-item"
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :row="row.original"
          :tanstack-row="row"
          :is-selected="row.getIsSelected()"
          :checkable="checkable"
          :toggle-row="() => row.toggleSelected()"
        >
          <div class="bg-card rounded-card border border-card-line p-4 hover:shadow-md transition-shadow relative"
            :class="{ 'ring-2 ring-indigo-400 dark:ring-indigo-600': row.getIsSelected() }">
            <div v-if="checkable" class="absolute top-2 left-2 z-10">
              <input type="checkbox" :checked="row.getIsSelected()" @change="row.toggleSelected()"
                class="rounded border-card-line dark:bg-card" />
            </div>
            <div class="space-y-2" :class="{ 'pt-6': checkable }">
              <div v-for="cell in row.getVisibleCells().filter(c => c.column.id !== 'select')" :key="cell.id" class="flex justify-between">
                <span class="text-sm text-muted-foreground">{{ cell.column.columnDef.meta?.label ?? cell.column.id }}:</span>
                <span class="text-sm text-foreground">
                  <slot :name="cell.column.id" :row="row.original" :value="cell.getValue()">{{ cell.getValue() }}</slot>
                </span>
              </div>
            </div>
          </div>
        </slot>
      </div>

      <div v-else class="flex items-center justify-center py-12">
        <slot v-if="!search && !columnFilters.length" name="empty">
          <p class="text-muted-foreground text-lg">No hay registros</p>
        </slot>
        <slot v-else name="empty-search">
          <p class="text-muted-foreground text-lg">No hay registros en la búsqueda</p>
        </slot>
      </div>
    </div>

    <!-- Pagination & controls bar -->
    <div ref="paginationBarRef" class="flex flex-col sm:flex-row items-center justify-between gap-y-4 sm:gap-y-0 px-4 py-3 border-t border-card-line">
      <!-- Left: reload, total, cache, columns button -->
      <div class="flex items-center gap-x-4 flex-wrap gap-y-2">
        <!-- Reload button -->
        <div v-if="showReloadButton" class="flex items-center gap-x-2">
          <IconReload
            v-if="!loading"
            class="size-4 cursor-pointer text-muted-foreground hover:text-muted-foreground-1 transition-colors"
            @click="reloadTable"
          />
          <div v-else>
            <svg class="animate-spin size-4 text-muted-foreground-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" opacity=".25" />
              <path d="M22 12a10 10 0 0 1-10 10" />
            </svg>
          </div>
        </div>

        <!-- Total records -->
        <p class="text-sm text-foreground font-medium">{{ rowCount }} registros</p>

        <!-- Cache badge -->
        <div v-if="isDataFromCache && cached" class="group relative flex items-center">
          <div class="flex items-center gap-x-1.5 py-1 px-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-badge cursor-help hover:bg-emerald-500/20 transition-colors">
            <IconBolt class="size-3.5 fill-current" />
            <span class="text-[10px] font-bold uppercase tracking-wider">Instant</span>
          </div>
          <div class="absolute bottom-full mb-2 left-0 hidden group-hover:block w-48 p-2.5 bg-slate-900 text-white text-[11px] leading-relaxed rounded-popover shadow-2xl z-50">
            <div class="font-bold mb-1 flex items-center gap-x-1.5 text-emerald-400">
              <IconBolt class="size-3" /> Datos en Caché
            </div>
            Los datos se cargaron instantáneamente desde la memoria local. Actualice para sincronizar con el servidor.
            <div class="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-900"></div>
          </div>
        </div>

      </div>

      <!-- Right: per-page + pagination -->
      <div class="flex items-center gap-x-8">
        <!-- Per page selector -->
        <div class="flex items-center gap-x-2">
          <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Filas:</label>
          <select
            v-if="!isCustomPerPage"
            :value="pagination.pageSize"
            @change="(e) => handlePerPageChange(e.target.value)"
            class="bg-surface border-none text-[11px] font-bold text-muted-foreground-1 rounded-control focus:ring-0 cursor-pointer py-1 pl-2 pr-8"
          >
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option value="custom">Otro...</option>
          </select>
          <div v-else class="flex items-center gap-x-1">
            <input
              type="number"
              :value="pagination.pageSize"
              @change="(e) => table.setPageSize(parseInt(e.target.value) || 10)"
              min="1" max="500"
              class="w-14 bg-surface border-none text-[11px] font-bold text-muted-foreground-1 rounded-control focus:ring-2 focus:ring-indigo-500/20 py-1 px-2"
            />
            <button @click="resetPerPage" class="text-[10px] text-indigo-500 font-bold hover:underline">Volver</button>
          </div>
        </div>

        <!-- Pagination nav -->
        <nav class="flex justify-end items-center gap-x-1" aria-label="Pagination">
          <button
            type="button"
            class="size-8 flex items-center justify-center rounded-control text-foreground hover:bg-muted-hover disabled:opacity-30"
            :disabled="!table.getCanPreviousPage()"
            @click="table.previousPage()"
          >
            <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div class="flex items-center gap-x-1 mx-2">
            <span class="size-8 flex items-center justify-center text-xs font-bold rounded-control bg-surface text-foreground">
              {{ pagination.pageIndex + 1 }}
            </span>
            <span class="text-[10px] font-bold text-muted-foreground uppercase mx-1">de</span>
            <span class="text-[10px] font-bold text-muted-foreground">{{ table.getPageCount() }}</span>
          </div>
          <button
            type="button"
            class="size-8 flex items-center justify-center rounded-control text-foreground hover:bg-muted-hover disabled:opacity-30"
            :disabled="!table.getCanNextPage()"
            @click="table.nextPage()"
          >
            <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* --row-bg drives the background of sticky (pinned) body cells.
   Only solid, opaque values here — semi-transparent tints for selected/preview
   rows intentionally do NOT override --row-bg, so pinned cells stay opaque
   and text from scrolling content can't bleed through. */
tbody tr {
  --row-bg: var(--card, #fff);
}
tbody tr:hover {
  --row-bg: var(--layer-hover, #f8fafc);
}
</style>

