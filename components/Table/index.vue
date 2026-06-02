<script setup>
import { useVueTable, getCoreRowModel } from '@tanstack/vue-table'
import {
  IconReload,
  IconBolt,
} from '@tabler/icons-vue'
import ViewTable from './views/ViewTable.vue'
import ViewCards from './views/ViewCards.vue'
import ViewDatabase from './views/ViewDatabase.vue'

const props = defineProps({
  endpoint: { type: String, required: true },
  columns: { type: Array, required: true }, // [{ key, label, sortable?, filterable?, class? }]
  params: { type: Object, default: () => ({}) },
  checkable: { type: Boolean, default: false },
  search: { type: String, default: '' },
  name: { type: String, required: true },
  cached: { type: Boolean, default: false },
  showReloadButton: { type: Boolean, default: true },
  /** 'bottom' (default) | 'top' — posición de la barra de paginación + reload + total + instant. */
  infoPosition:     { type: String, default: 'bottom' },
  /** Mostrar el selector "Filas: 10/25/50/100/Otro...". Default false. */
  showPerPage:      { type: Boolean, default: false },
  /** Modo lista: sin paginación (envía ?list=true, carga todas las filas y scrollea). */
  list:             { type: Boolean, default: false },
  /** 'table' | 'cards' | 'database' | 'grid' (legacy → maps to cards) */
  viewMode: { type: String, default: 'table' },
  gridClass: { type: String, default: 'grid grid-cols-2 lg:grid-cols-3 gap-4' },
  clickRowToOpen:  { type: Boolean, default: false },
  previewRowId:    { type: [String, Number], default: null },
  previewMode:     { type: Boolean, default: false },
  pinnedColumns:   { type: Object, default: null }, // { left?: string[], right?: string[] }
  /** Mutation function for database inline editing: async (row, colKey, value) => void */
  updateMutation:  { type: Function, default: null },
  bordered:        { type: Boolean, default: true },
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
const viewTableRef = ref(null)
const paginationBarRef = ref(null)
const skeletonRows = computed(() => {
  const count = lastDataLength.value < 0 ? pagination.value.pageSize : lastDataLength.value
  return Array.from({ length: count })
})

// Backward compat: 'grid' maps to 'cards'
const currentView = computed(() => {
  const v = props.viewMode
  if (v === 'grid') return 'cards'
  return v // 'table' | 'cards' | 'database'
})

// ─── Inline editing state (used by ViewDatabase) ──────────────────────────────
const editingCell = ref(null)   // { rowId, colKey } | null
const editingValue = ref('')
const savingCell = ref(null)    // { rowId, colKey } | null
const cellError = ref(null)     // { rowId, colKey, message } | null

const startEdit = (row, col) => {
  editingCell.value = { rowId: row.id, colKey: col.column.id }
  editingValue.value = String(col.getValue() ?? '')
  cellError.value = null
}

const cancelEdit = () => {
  editingCell.value = null
  editingValue.value = ''
  cellError.value = null
}

const saveEdit = async (row, col) => {
  if (!props.updateMutation || !editingCell.value) return
  const { rowId, colKey } = editingCell.value
  const value = editingValue.value
  editingCell.value = null
  editingValue.value = ''
  savingCell.value = { rowId, colKey }
  cellError.value = null
  try {
    await props.updateMutation(row.original, colKey, value)
  } catch (e) {
    cellError.value = { rowId, colKey, message: e?.message ?? 'Error al guardar' }
  } finally {
    savingCell.value = null
  }
}

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
      meta: {
        class: col.class ?? '',
        label: col.label,
        editable: col.editable ?? false,
        type: col.type ?? 'text',
        options: col.options ?? [],
      },
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
  const bg = isHeader ? 'var(--card, #fff)' : 'var(--row-bg, var(--card, #fff))'
  const base = {
    position: 'sticky',
    zIndex: z,
    background: bg,
    width: w,
    minWidth: w,
    maxWidth: w,
  }
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
    // Modo lista: sin paginación, el backend devuelve todas las filas (search/sort/filtros igual).
    ...(props.list ? { list: true } : {}),
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

// ─── Scheduled fetch ──────────────────────────────────────────────────────────
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

// ─── Restore guard ────────────────────────────────────────────────────────────
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
  if (newData.length > 0 && viewTableRef.value?.tableBodyEl) {
    const firstDataRow = Array.from(viewTableRef.value.tableBodyEl.children).find(el => el.dataset.rowType === 'data')
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

// ─── Header drag reorder (handler called from ViewTable) ──────────────────────
const onHeaderDrop = (fromId, toId) => {
  if (!fromId || fromId === toId) return
  if (toId === 'select') return
  const order = [...columnOrder.value]
  const from = order.indexOf(fromId)
  const to = order.indexOf(toId)
  if (from < 0 || to < 0) return
  order.splice(from, 1)
  order.splice(to, 0, fromId)
  const selIdx = order.indexOf('select')
  if (selIdx > 0) { order.splice(selIdx, 1); order.unshift('select') }
  columnOrder.value = order
}

// ─── Column auto-size on double click ─────────────────────────────────────────
const _canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
const _ctx = _canvas?.getContext('2d')

const measureText = (text, font) => {
  if (!_ctx) return 0
  _ctx.font = font
  return _ctx.measureText(String(text ?? '')).width
}

const onAutoSizeColumn = (header) => {
  const colId = header.column.id
  const pad = 32
  const tbody = viewTableRef.value?.tableBodyEl

  const label = header.column.columnDef.meta?.label ?? header.id
  let max = measureText(label, '500 12px ui-sans-serif,system-ui,sans-serif') + pad + 20

  if (tbody) {
    tbody.querySelectorAll(`td[data-col-id="${colId}"]`).forEach(td => {
      const w = measureText(td.textContent?.trim(), '14px ui-sans-serif,system-ui,sans-serif') + pad
      if (w > max) max = w
    })
  }

  table.setColumnSizing(prev => ({ ...prev, [colId]: Math.ceil(max) }))
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

const pinnedRowStyle = (row) => {
  if (props.previewRowId && row.original.id === props.previewRowId) {
    return { '--row-bg': 'color-mix(in srgb, #eef2ff 100%, var(--card, #fff))' }
  }
  if (row.getIsSelected()) {
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

const setPageSize = (size) => {
  pagination.value = { pageIndex: 0, pageSize: size }
  table.setPageSize(size)
}

defineExpose({
  getSelectedRows,
  loading,
  exportTable,
  reload: reloadTable,
  clearCache,
  table,
  setColumnOrder,
  setPageSize,
  isDataFromCache,
  cached: computed(() => props.cached),
  paginationBarRef,
  columnPinning,
  pinColumn,
  editingCell,
  cancelEdit,
})
</script>

<template>
  <div class="relative flex flex-col">

    <!-- Modo lista: contenedor scrolleable (todas las filas cargadas, sin paginación) -->
    <div :class="list ? 'max-h-[70vh] overflow-y-auto' : 'contents'">

    <!-- Table view -->
    <ViewTable
      v-if="currentView === 'table'"
      ref="viewTableRef"
      :table="table"
      :loading="loading"
      :skeleton-rows="skeletonRows"
      :last-row-height="lastRowHeight"
      :checkable="checkable"
      :preview-row-id="previewRowId"
      :is-row-click-enabled="isRowClickEnabled"
      :search="search"
      :column-filters="columnFilters"
      :has-filterable-columns="hasFilterableColumns"
      :pagination="pagination"
      :get-pinned-styles="getPinnedStyles"
      :pinned-row-style="pinnedRowStyle"
      :on-header-drop="onHeaderDrop"
      :on-auto-size-column="onAutoSizeColumn"
      @row-click="handleRowClick"
      @row-keydown="handleRowKeydown"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </ViewTable>

    <!-- Cards / grid view -->
    <ViewCards
      v-else-if="currentView === 'cards'"
      :table="table"
      :loading="loading"
      :skeleton-rows="skeletonRows"
      :checkable="checkable"
      :grid-class="gridClass"
      :search="search"
      :column-filters="columnFilters"
      :bordered="bordered"
      @row-click="handleRowClick"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </ViewCards>

    <!-- Database inline-edit view -->
    <ViewDatabase
      v-else-if="currentView === 'database'"
      :table="table"
      :loading="loading"
      :skeleton-rows="skeletonRows"
      :last-row-height="lastRowHeight"
      :checkable="checkable"
      :editing-cell="editingCell"
      :editing-value="editingValue"
      :saving-cell="savingCell"
      :cell-error="cellError"
      @row-click="handleRowClick"
      @start-edit="startEdit"
      @save-edit="saveEdit"
      @cancel-edit="cancelEdit"
      @editing-value-change="(v) => editingValue = v"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </ViewDatabase>

    </div><!-- /scroll lista -->

    <!-- Pagination & controls bar -->
    <div
      v-if="infoPosition !== 'none'"
      ref="paginationBarRef"
      :class="[
        'flex flex-col sm:flex-row items-center justify-between gap-y-4 sm:gap-y-0 px-4 py-3',
        infoPosition === 'top' ? 'order-first border-b border-card-line' : 'border-t border-card-line',
      ]"
    >
      <!-- Left: reload, total, cache -->
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

      <!-- Right: per-page + pagination (oculto en modo lista) -->
      <div v-if="!list" class="flex items-center gap-x-8">
        <!-- Per page selector -->
        <div v-if="showPerPage" class="flex items-center gap-x-2">
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
