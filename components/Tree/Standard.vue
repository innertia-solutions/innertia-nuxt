<script setup>
import {
  IconLoader2, IconSearch, IconRefresh, IconPlus,
  IconLayoutColumns, IconChevronDown, IconX, IconDownload,
  IconFileTypeXls, IconFileTypeCsv, IconFileTypePdf, IconCodeDots,
} from '@tabler/icons-vue'

const props = defineProps({
  // Required: backend route that returns DataTree-shaped responses.
  endpoint: { type: String, required: true },

  // Columns shape (compatible with Table.Standard):
  //   { key, label, size?, sortable?, filterType?: 'text'|'select'|'daterange', filterOptions?, hidden? }
  // The first column is the "name" column and gets indented + chevron.
  columns:  { type: Array, required: true },

  // Optional name (used for cache keys / export filename).
  name:     { type: String, default: '' },

  // Extra body params merged into the request.
  params:   { type: Object, default: () => ({}) },

  // Filters reactive (igual a Table.Standard).
  filters:  { type: Array, default: () => [] },

  // Toolbar visibility.
  showSearch:        { type: Boolean, default: true },
  searchPlaceholder: { type: String,  default: 'Buscar...' },
  showFilters:       { type: Boolean, default: true },
  showColumns:       { type: Boolean, default: true },
  showExport:        { type: Boolean, default: true },
  showReloadButton:  { type: Boolean, default: true },

  // Checkbox selection (multi-select).
  checkable:         { type: Boolean, default: false },

  // Row interaction.
  rowHref:       { type: [String, Function], default: null },
  clickableRows: { type: Boolean, default: true },

  // Empty state.
  emptyMessage: { type: String, default: 'No hay registros.' },
})

const emit = defineEmits([
  'row-click', 'loaded', 'expand',
  'update:checked', 'export',
])

const api = useApi()

// ─── State ────────────────────────────────────────────────────────────────────
const roots         = ref([])
const meta          = ref(null)
const loading       = ref(false)
const isFetching    = ref(false)
const search        = ref('')
const expandedSet   = ref(new Set())
const loadingSet    = ref(new Set())
const childrenById  = ref({})
const checkedSet    = ref(new Set())

// Filters — { [colKey]: value }
const activeFilters = ref({})

// Column visibility — { [colKey]: boolean }
const columnVisibility = ref(
  Object.fromEntries(props.columns.map(c => [c.key, c.hidden !== true]))
)

// ─── Derived ──────────────────────────────────────────────────────────────────
const filterableColumns = computed(() =>
  props.filters?.length ? props.filters : props.columns.filter(c => c.filterType)
)
const hasFilterableColumns = computed(() => filterableColumns.value.length > 0)

const activeFilterList = computed(() =>
  Object.entries(activeFilters.value)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([key, value]) => {
      const col = props.columns.find(c => c.key === key) ?? filterableColumns.value.find(c => c.key === key)
      const label = col?.label ?? key
      let displayVal = value
      if (col?.filterType === 'select' && Array.isArray(col?.filterOptions)) {
        const opt = col.filterOptions.find(o => o.value === value)
        if (opt) displayVal = opt.label
      }
      return { key, col, label, displayVal: String(displayVal) }
    })
)

const visibleColumns = computed(() =>
  props.columns.filter(c => columnVisibility.value[c.key] !== false)
)

const nameColKey    = computed(() => props.columns[0]?.key ?? 'name')
const totalRendered = computed(() => meta.value?.total_nodes ?? 0)

// ─── Fetching ─────────────────────────────────────────────────────────────────
const buildBody = (extra = {}) => ({
  ...props.params,
  search:  search.value.trim(),
  filters: { ...activeFilters.value },
  ...extra,
})

const fetchInitial = async () => {
  loading.value = true
  isFetching.value = true
  try {
    const res = await api.post(props.endpoint, buildBody())
    roots.value = res?.data ?? []
    meta.value  = res?.meta ?? null
    childrenById.value = {}
    emit('loaded', res)
  } catch (e) {
    console.error('[Tree.Standard] initial fetch failed:', e)
    roots.value = []
  } finally {
    loading.value = false
    isFetching.value = false
  }
}

const fetchChildren = async (nodeId) => {
  if (childrenById.value[nodeId]) return
  if (loadingSet.value.has(nodeId)) return
  loadingSet.value = new Set([...loadingSet.value, nodeId])
  try {
    const res = await api.post(props.endpoint, buildBody({ expand: nodeId }))
    childrenById.value[nodeId] = res?.data ?? []
    emit('expand', { nodeId, children: childrenById.value[nodeId] })
  } catch (e) {
    console.error(`[Tree.Standard] expand fetch failed for ${nodeId}:`, e)
    childrenById.value[nodeId] = []
  } finally {
    const next = new Set(loadingSet.value)
    next.delete(nodeId)
    loadingSet.value = next
  }
}

const toggle = async (node) => {
  const id = node.id
  const next = new Set(expandedSet.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
    const needsLazy = node.has_children
      && (!Object.prototype.hasOwnProperty.call(node, 'children'))
    if (needsLazy) await fetchChildren(id)
  }
  expandedSet.value = next
}

// ─── Search (debounced) ───────────────────────────────────────────────────────
let searchTimer = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchInitial(), 250)
})

// ─── Filters ──────────────────────────────────────────────────────────────────
const showFilterPanel = ref(false)
const filterAddBtnRef = ref(null)

const openFilterMenu = () => {
  showFilterPanel.value = !showFilterPanel.value
}

const updateFilters = (next) => {
  activeFilters.value = { ...next }
  fetchInitial()
}

const removeFilter = (key) => {
  const next = { ...activeFilters.value }
  delete next[key]
  activeFilters.value = next
  fetchInitial()
}

// ─── Column visibility ────────────────────────────────────────────────────────
const showColumnPanel = ref(false)

const toggleColumnVisibility = (key) => {
  columnVisibility.value = {
    ...columnVisibility.value,
    [key]: !columnVisibility.value[key],
  }
}

const visibleColumnCount = computed(() =>
  Object.values(columnVisibility.value).filter(Boolean).length
)

// ─── Checkbox selection ───────────────────────────────────────────────────────
const flattenedIds = computed(() => {
  const acc = []
  const walk = (nodes) => {
    for (const n of nodes) {
      acc.push(n.id)
      const kids = Array.isArray(n.children) ? n.children : (childrenById.value[n.id] ?? [])
      if (kids.length) walk(kids)
    }
  }
  walk(roots.value)
  return acc
})

const allChecked = computed(() =>
  flattenedIds.value.length > 0
    && flattenedIds.value.every(id => checkedSet.value.has(id))
)
const someChecked = computed(() =>
  flattenedIds.value.some(id => checkedSet.value.has(id))
    && !allChecked.value
)

const toggleCheck = (node) => {
  const next = new Set(checkedSet.value)
  if (next.has(node.id)) next.delete(node.id)
  else next.add(node.id)
  checkedSet.value = next
  emit('update:checked', [...next])
}

const toggleCheckAll = () => {
  if (allChecked.value) {
    checkedSet.value = new Set()
  } else {
    checkedSet.value = new Set(flattenedIds.value)
  }
  emit('update:checked', [...checkedSet.value])
}

const clearChecked = () => {
  checkedSet.value = new Set()
  emit('update:checked', [])
}

// ─── Export ───────────────────────────────────────────────────────────────────
const showExportPanel = ref(false)
const exportFormat    = ref('xlsx')
const exportFilename  = ref(props.name || 'export')

watch(() => props.name, (v) => { if (v) exportFilename.value = v })

const exportFormats = [
  { value: 'xlsx', label: 'Excel', icon: IconFileTypeXls },
  { value: 'csv',  label: 'CSV',   icon: IconFileTypeCsv },
  { value: 'pdf',  label: 'PDF',   icon: IconFileTypePdf },
  { value: 'json', label: 'JSON',  icon: IconCodeDots    },
]

/**
 * Flatten visible tree (con depth como prefijo en la columna del nombre) y delega
 * al consumidor via emit('export', { format, filename, rows, columns }).
 * El parent puede engancharlo a un endpoint backend de export — o ignorar y manejar
 * client-side (xlsx-js, csv-stringify, etc.).
 */
const performExport = () => {
  const rows = []
  const walk = (nodes, depth = 0) => {
    for (const n of nodes) {
      const row = { ...n }
      row[nameColKey.value] = `${'  '.repeat(depth)}${n[nameColKey.value] ?? ''}`
      rows.push(row)
      const kids = Array.isArray(n.children) ? n.children : (childrenById.value[n.id] ?? [])
      if (kids.length && expandedSet.value.has(n.id)) walk(kids, depth + 1)
    }
  }
  walk(roots.value)

  emit('export', {
    format:   exportFormat.value,
    filename: exportFilename.value,
    rows,
    columns:  visibleColumns.value,
  })
  showExportPanel.value = false
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(fetchInitial)

defineExpose({
  refresh: fetchInitial,
  clearChecked,
  getChecked: () => [...checkedSet.value],
})
</script>

<template>
  <div class="relative">

    <!-- ── Toolbar ────────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center gap-2 mb-2">

      <!-- Search -->
      <div v-if="showSearch" class="flex-1 min-w-48 max-w-xs">
        <Forms.Input v-model="search" type="search" :placeholder="searchPlaceholder" :icon-left="IconSearch" size="sm" />
      </div>

      <!-- + Filtros -->
      <div v-if="showFilters && hasFilterableColumns" ref="filterAddBtnRef" class="relative">
        <button
          type="button"
          @click="openFilterMenu"
          :class="[
            'inline-flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-lg border transition-colors',
            activeFilterList.length
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-card-line bg-card text-muted-foreground-1 hover:bg-muted-hover',
          ]"
        >
          <IconPlus class="size-3.5" />
          Filtros{{ activeFilterList.length ? ` (${activeFilterList.length})` : '' }}
        </button>

        <!-- Filter panel -->
        <Transition
          enter-active-class="transition ease-out duration-150"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showFilterPanel"
            class="absolute left-0 top-full mt-1 z-30 w-80 bg-card border border-card-line rounded-xl shadow-xl p-4"
            @click.stop
          >
            <TableFilter :model-value="activeFilters" :columns="filterableColumns" @update:model-value="updateFilters" />
            <div class="flex justify-end gap-2 mt-3">
              <button
                type="button"
                @click="showFilterPanel = false"
                class="text-xs text-muted-foreground hover:text-foreground"
              >Cerrar</button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Slot for custom toolbar buttons -->
      <slot name="toolbar" :checked="[...checkedSet]" :clear-checked="clearChecked" />

      <!-- Secondary actions -->
      <div class="ml-auto flex items-center gap-1">

        <!-- Columns dropdown -->
        <div v-if="showColumns" class="relative">
          <button
            type="button"
            @click="showColumnPanel = !showColumnPanel"
            title="Columnas"
            :class="[
              'p-1.5 inline-flex items-center justify-center rounded-lg border transition-colors',
              showColumnPanel
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:border-card-line hover:bg-muted-hover hover:text-foreground',
            ]"
          >
            <IconLayoutColumns class="size-4" />
          </button>

          <Transition
            enter-active-class="transition ease-out duration-150"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="showColumnPanel"
              class="absolute right-0 top-full mt-1 z-30 w-56 bg-card border border-card-line rounded-xl shadow-xl p-2"
              @click.stop
            >
              <p class="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Columnas ({{ visibleColumnCount }}/{{ columns.length }})
              </p>
              <ul class="mt-1 space-y-0.5">
                <li v-for="col in columns" :key="col.key">
                  <label class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted-hover cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      :checked="columnVisibility[col.key] !== false"
                      :disabled="col.key === nameColKey"
                      class="size-3.5 rounded border-card-line text-primary focus:ring-primary/30"
                      @change="toggleColumnVisibility(col.key)"
                    />
                    <span class="text-foreground">{{ col.label }}</span>
                  </label>
                </li>
              </ul>
            </div>
          </Transition>
        </div>

        <!-- Export dropdown -->
        <div v-if="showExport" class="relative">
          <button
            type="button"
            @click="showExportPanel = !showExportPanel"
            title="Exportar"
            :class="[
              'p-1.5 inline-flex items-center justify-center rounded-lg border transition-colors',
              showExportPanel
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:border-card-line hover:bg-muted-hover hover:text-foreground',
            ]"
          >
            <IconDownload class="size-4" />
          </button>

          <Transition
            enter-active-class="transition ease-out duration-150"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="showExportPanel"
              class="absolute right-0 top-full mt-1 z-30 w-72 bg-card border border-card-line rounded-xl shadow-xl p-3 space-y-3"
              @click.stop
            >
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">Nombre del archivo</label>
                <input
                  v-model="exportFilename"
                  type="text"
                  class="w-full text-sm px-2 py-1.5 border border-card-line rounded-md bg-transparent focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-1">Formato</p>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    v-for="f in exportFormats"
                    :key="f.value"
                    type="button"
                    @click="exportFormat = f.value"
                    :class="[
                      'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors',
                      exportFormat === f.value
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-card-line text-foreground hover:bg-muted-hover',
                    ]"
                  >
                    <component :is="f.icon" class="size-4" stroke="1.5" />
                    {{ f.label }}
                  </button>
                </div>
              </div>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  @click="showExportPanel = false"
                  class="text-xs text-muted-foreground hover:text-foreground"
                >Cancelar</button>
                <button
                  type="button"
                  @click="performExport"
                  class="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover"
                >Exportar</button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Reload -->
        <button
          v-if="showReloadButton"
          type="button"
          @click="fetchInitial"
          :disabled="isFetching"
          title="Recargar"
          class="p-1.5 inline-flex items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:border-card-line hover:bg-muted-hover hover:text-foreground transition-colors disabled:opacity-50"
        >
          <IconRefresh class="size-4" :class="isFetching ? 'animate-spin' : ''" />
        </button>
      </div>
    </div>

    <!-- ── Filter chips ───────────────────────────────────────────────────── -->
    <div v-if="activeFilterList.length" class="flex flex-wrap items-center gap-1.5 mb-2">
      <div
        v-for="chip in activeFilterList"
        :key="chip.key"
        class="inline-flex items-center text-xs rounded-lg border border-card-line bg-card overflow-hidden"
      >
        <span class="px-2.5 py-1 text-foreground font-medium border-r border-card-line bg-surface">{{ chip.label }}</span>
        <span class="px-2 py-1 text-primary font-medium">{{ chip.displayVal }}</span>
        <button
          type="button"
          @click.stop="removeFilter(chip.key)"
          class="px-1.5 py-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <IconX class="size-3" />
        </button>
      </div>
    </div>

    <!-- ── Selection bar (when items checked) ─────────────────────────────── -->
    <div
      v-if="checkable && checkedSet.size > 0"
      class="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20"
    >
      <span class="text-sm text-primary font-medium">
        {{ checkedSet.size }} seleccionado{{ checkedSet.size === 1 ? '' : 's' }}
      </span>
      <div class="flex items-center gap-2">
        <slot name="selection-actions" :checked="[...checkedSet]" :clear="clearChecked" />
        <button
          type="button"
          @click="clearChecked"
          class="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <IconX class="size-3" /> Limpiar
        </button>
      </div>
    </div>

    <!-- ── Table wrapper (rounded) ────────────────────────────────────────── -->
    <div class="overflow-x-auto border border-card-line rounded-xl">
      <table class="w-full divide-y divide-card-line" style="table-layout: auto">

        <!-- Header -->
        <thead class="relative z-10 bg-card">
          <tr class="bg-card">
            <th
              v-if="checkable"
              scope="col"
              class="w-10 px-4 py-3"
            >
              <input
                type="checkbox"
                :checked="allChecked"
                :indeterminate.prop="someChecked"
                class="size-4 rounded border-card-line text-primary focus:ring-primary/30 cursor-pointer"
                @change="toggleCheckAll"
              />
            </th>
            <th
              v-for="col in visibleColumns"
              :key="col.key"
              scope="col"
              :style="col.size ? { width: col.size + 'px' } : {}"
            >
              <div class="px-4 py-3 flex items-center gap-x-1 text-xs font-medium text-muted-foreground">
                <span class="truncate">{{ col.label }}</span>
              </div>
            </th>
          </tr>
        </thead>

        <!-- Body -->
        <tbody class="divide-y divide-card-line">

          <!-- Loading skeleton -->
          <template v-if="loading">
            <tr v-for="i in 5" :key="`sk-${i}`" class="animate-pulse bg-card">
              <td v-if="checkable" class="px-4 py-3"><div class="h-4 w-4 bg-muted/60 rounded" /></td>
              <td v-for="col in visibleColumns" :key="col.key" class="px-4 py-3">
                <div class="h-3 bg-muted/60 rounded w-3/4" />
              </td>
            </tr>
          </template>

          <!-- Empty -->
          <tr v-else-if="!roots.length">
            <td :colspan="visibleColumns.length + (checkable ? 1 : 0)" class="py-12 text-center text-sm text-muted-foreground bg-card">
              {{ emptyMessage }}
            </td>
          </tr>

          <!-- Tree -->
          <template v-else>
            <TreeNode
              v-for="root in roots"
              :key="root.id"
              :node="root"
              :columns="columns"
              :depth="0"
              :expanded="expandedSet"
              :loading-set="loadingSet"
              :children-by-id="childrenById"
              :row-href="rowHref"
              :clickable-rows="clickableRows"
              :name-col-key="nameColKey"
              :checkable="checkable"
              :checked-set="checkedSet"
              :column-visibility="columnVisibility"
              @toggle="toggle"
              @check="toggleCheck"
              @row-click="(n) => emit('row-click', n)"
            >
              <template v-for="col in columns" :key="col.key" #[`cell-${col.key}`]="slotProps">
                <slot :name="`cell-${col.key}`" v-bind="slotProps" />
              </template>
            </TreeNode>
          </template>
        </tbody>
      </table>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between gap-2 mt-2 px-1 text-xs text-muted-foreground">
      <div class="flex items-center gap-2">
        <IconLoader2 v-if="isFetching && !loading" class="size-3.5 animate-spin" />
        <span>{{ totalRendered }} {{ totalRendered === 1 ? 'nodo' : 'nodos' }}</span>
      </div>
      <div></div>
    </div>

  </div>
</template>
