<script setup>
import {
  IconLoader2, IconSearch, IconRefresh, IconPlus, IconBolt, IconReload,
  IconLayoutColumns, IconChevronDown, IconX, IconDownload,
  IconFileTypeXls, IconFileTypeCsv, IconFileTypePdf, IconCodeDots,
} from '@tabler/icons-vue'

const slots = useSlots()

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

  // Cacheo en sessionStorage. Cuando true, al montar el componente intenta
  // restaurar la última respuesta cacheada (≤10 min) y muestra el badge
  // "Instant" hasta que el usuario haga reload manual.
  cached: { type: Boolean, default: false },

  // Checkbox selection (multi-select).
  checkable:         { type: Boolean, default: false },

  // Row interaction.
  rowHref:       { type: [String, Function], default: null },
  clickableRows: { type: Boolean, default: true },

  // Empty state.
  emptyMessage: { type: String, default: 'No hay registros.' },

  // Variante visual:
  //   'table' — clásico con filas, columnas y bordes (default)
  //   'list'  — compacto tipo file-tree explorer (sin tabla, sin bordes de fila)
  variant: { type: String, default: 'table' },

  // bordered=false → quita border + rounded-card del wrapper exterior
  bordered: { type: Boolean, default: true },

  // 'bottom' (default) | 'top' | 'none' — dónde aparecen reload + total + instant
  //   'none' = sin footer, reload + instant compactos al lado de columns/export
  infoPosition: { type: String, default: 'bottom' },

  // Tamaño visible del área scrollable.
  //   'sm'  — compacta (min 18rem / max 24rem)
  //   'md'  — default (min 30rem / max 36rem)
  //   'lg'  — espaciosa (min 45rem / max 75vh)
  //   'fit' — sin min/max, se adapta al contenedor padre
  size: { type: String, default: 'md' },

  // ─── Preview overlay panel (mismo patrón que Table.Standard) ───────────
  // El panel se activa automáticamente si el consumer declara <slot name="preview">.
  // Click en una fila → set previewRow → overlay absoluto sobre la derecha de la tabla.
  previewHref:       { type: [String, Function], default: null },
  previewDeletable:  { type: Boolean, default: false },
  autoClosePreview:  { type: Boolean, default: true },
  /** Porcentaje inicial de la tabla (0-100). El resto lo ocupa el preview. */
  splitRatio:        { type: Number, default: 55 },

  // Resalta la fila seleccionada (id del nodo). Para selección externa via @row-click.
  selectedId:        { type: [String, Number], default: null },
})

const sizeStyle = computed(() => {
  switch (props.size) {
    case 'sm':  return { minHeight: '18rem', maxHeight: '24rem' }
    case 'lg':  return { minHeight: '45rem', maxHeight: '75vh' }
    case 'fit': return {}
    case 'md':
    default:    return { minHeight: '30rem', maxHeight: '36rem' }
  }
})

const emit = defineEmits([
  'row-click', 'loaded', 'expand',
  'update:checked', 'export',
  'preview-delete',
])

const api = useApi()

// ─── State ────────────────────────────────────────────────────────────────────
const roots         = ref([])
const meta          = ref(null)
const loading       = ref(false)
const isFetching    = ref(false)
const isDataFromCache = ref(false)

// ─── Preview state — la UI vive en <DataPreview>, este file solo le pasa la fila activa ─
const previewEnabled = computed(() => !!slots.preview)
const previewRow     = ref(null)
const containerRef   = ref(null)
const dataPreviewRef = ref(null)

const closePreview = () => { previewRow.value = null }

// Endpoint de historial — derivado del meta del backend.
// El backend debe devolver { meta: { has_history: true, entity_type: 'departments' } }
// para activar el tab "Bitácora" del DataPreview.
const resolvedHistoryEndpoint = computed(() => {
  if (!meta.value?.has_history || !previewRow.value?.id || !meta.value?.entity_type) return null
  return `history/${meta.value.entity_type}/${previewRow.value.id}`
})

const { collapseDock } = useDockedPreviews()

const handleRowClick = (node) => {
  emit('row-click', node)
  if (!previewEnabled.value) return
  if (previewRow.value?.id === node.id) return
  collapseDock()
  previewRow.value = node
}

// ESC + click-fuera (la UI los maneja, este file detecta cuándo cerrar).
const onEsc = (e) => {
  if (e.key !== 'Escape') return
  if (previewRow.value) closePreview()
  else collapseDock()
}
const onDocMousedown = (e) => {
  if (!props.autoClosePreview || !previewRow.value) return
  const panelEl = dataPreviewRef.value?.panelRef
  if (containerRef.value?.contains(e.target)) return
  if (panelEl?.contains(e.target)) return
  closePreview()
}
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
  isDataFromCache.value = false
  try {
    const res = await api.post(props.endpoint, buildBody())
    roots.value = res?.data ?? []
    meta.value  = res?.meta ?? null
    childrenById.value = {}
    if (props.cached) saveToCache()
    emit('loaded', res)
  } catch (e) {
    console.error('[Tree.Standard] initial fetch failed:', e)
    roots.value = []
  } finally {
    loading.value = false
    isFetching.value = false
  }
}

/**
 * Refresca el árbol PRESERVANDO la expansión actual: re-fetchea los roots y los
 * hijos de cada nodo expandido (datos frescos, sin colapsar ni resetear scroll).
 * Útil tras mutar un nodo (ej. marcar revisado) sin remontar el componente.
 */
const reload = async () => {
  // No tocamos `loading` (eso dispara el skeleton y hace desaparecer el árbol).
  // Solo `isFetching` → spinner sutil, el árbol queda visible durante el refresh.
  isFetching.value = true
  isDataFromCache.value = false
  try {
    const res = await api.post(props.endpoint, buildBody())
    roots.value = res?.data ?? []
    meta.value  = res?.meta ?? null

    const expanded = [...expandedSet.value]
    const fresh = {}
    await Promise.all(expanded.map(async (nodeId) => {
      try {
        const r = await api.post(props.endpoint, buildBody({ expand: nodeId }))
        fresh[nodeId] = r?.data ?? []
      } catch {
        fresh[nodeId] = childrenById.value[nodeId] ?? []
      }
    }))
    childrenById.value = fresh
    if (props.cached) saveToCache()
    emit('loaded', res)
  } catch (e) {
    console.error('[Tree.Standard] reload failed:', e)
  } finally {
    isFetching.value = false
  }
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const cacheKey = computed(() => {
  if (!props.cached || !props.name) return null
  const base = `tree_${props.name}`
  if (!Object.keys(props.params).length) return base
  try { return base + '_' + btoa(JSON.stringify(props.params)) } catch { return base }
})

const saveToCache = () => {
  if (!cacheKey.value || !roots.value.length) return
  try {
    sessionStorage.setItem(cacheKey.value, JSON.stringify({
      roots: roots.value,
      meta: meta.value,
      childrenById: childrenById.value,
      expanded: [...expandedSet.value],
      search: search.value,
      filters: activeFilters.value,
      columnVisibility: columnVisibility.value,
      timestamp: Date.now(),
    }))
  } catch (e) {
    console.warn('[Tree.Standard] cache save error:', e)
  }
}

const loadFromCacheOnMount = () => {
  if (!cacheKey.value) return false
  try {
    const raw = sessionStorage.getItem(cacheKey.value)
    if (!raw) return false
    const cached = JSON.parse(raw)
    if (Date.now() - cached.timestamp > 10 * 60 * 1000) {
      sessionStorage.removeItem(cacheKey.value)
      return false
    }
    roots.value = cached.roots ?? []
    meta.value = cached.meta ?? null
    childrenById.value = cached.childrenById ?? {}
    expandedSet.value = new Set(cached.expanded ?? [])
    search.value = cached.search ?? ''
    activeFilters.value = cached.filters ?? {}
    columnVisibility.value = cached.columnVisibility ?? columnVisibility.value
    isDataFromCache.value = true
    return true
  } catch {
    return false
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

// Refetch cuando cambian los params externos (p.ej. filtros del consumer).
watch(() => props.params, () => fetchInitial(), { deep: true })

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

// ─── Tree-aware check helpers ─────────────────────────────────────────────────
// Buscan en el árbol roots + en childrenById (lazy-loaded). Devuelven children
// directos de un nodo, o lo buscan por id.
const getChildren = (node) => {
  if (Array.isArray(node.children) && node.children.length) return node.children
  return childrenById.value[node.id] ?? []
}

const findNode = (id, nodes = roots.value) => {
  for (const n of nodes) {
    if (n.id === id) return n
    const kids = getChildren(n)
    if (kids.length) {
      const found = findNode(id, kids)
      if (found) return found
    }
  }
  return null
}

const findParent = (childId, nodes = roots.value, parent = null) => {
  for (const n of nodes) {
    if (n.id === childId) return parent
    const kids = getChildren(n)
    if (kids.length) {
      const found = findParent(childId, kids, n)
      if (found !== null || kids.some(k => k.id === childId)) return found ?? n
    }
  }
  return null
}

// Todos los descendientes (no incluye el propio nodo).
const getDescendantIds = (node) => {
  const out = []
  const walk = (n) => {
    for (const c of getChildren(n)) {
      out.push(c.id)
      walk(c)
    }
  }
  walk(node)
  return out
}

// Estado de checked agregado de un nodo: { full, none, some } basado en hijos directos.
const aggregateCheck = (node, set) => {
  const kids = getChildren(node)
  if (!kids.length) return set.has(node.id) ? 'full' : 'none'
  let checked = 0
  let partial = 0
  for (const c of kids) {
    const s = aggregateCheck(c, set)
    if (s === 'full') checked++
    else if (s === 'some') partial++
  }
  if (partial > 0) return 'some'
  if (checked === 0) return 'none'
  if (checked === kids.length) return 'full'
  return 'some'
}

// indeterminateSet — nodos donde algunos descendientes están checked, no todos.
const indeterminateSet = computed(() => {
  const out = new Set()
  const walk = (nodes) => {
    for (const n of nodes) {
      if (aggregateCheck(n, checkedSet.value) === 'some') out.add(n.id)
      const kids = getChildren(n)
      if (kids.length) walk(kids)
    }
  }
  walk(roots.value)
  return out
})

const toggleCheck = (node) => {
  const next = new Set(checkedSet.value)
  const ids = [node.id, ...getDescendantIds(node)]
  const willCheck = !next.has(node.id)
  for (const id of ids) {
    if (willCheck) next.add(id)
    else next.delete(id)
  }

  // Re-evaluar ancestros: un padre queda checked sólo si TODOS sus descendientes lo están.
  let ancestor = findParent(node.id)
  while (ancestor) {
    const state = aggregateCheck(ancestor, next)
    if (state === 'full') next.add(ancestor.id)
    else next.delete(ancestor.id)
    ancestor = findParent(ancestor.id)
  }

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
onMounted(() => {
  window.addEventListener('keydown', onEsc)
  document.addEventListener('mousedown', onDocMousedown)
  // Si tenemos cache de datos válido, lo mostramos al toque sin esperar el fetch.
  if (loadFromCacheOnMount()) return
  fetchInitial()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEsc)
  document.removeEventListener('mousedown', onDocMousedown)
})

defineExpose({
  refresh: fetchInitial,
  reload, // refresca preservando expansión (sin colapsar)
  clearChecked,
  getChecked: () => [...checkedSet.value],
})
</script>

<template>
  <div class="relative" ref="containerRef">

    <!-- ── Toolbar ────────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center gap-2 mb-2">

      <!-- Search -->
      <div v-if="showSearch" class="flex-1 min-w-48 max-w-xs">
        <Forms.Input v-model="search" type="text" :placeholder="searchPlaceholder" :icon-right="IconSearch" size="sm" />
      </div>

      <!-- + Filtros -->
      <div v-if="showFilters && hasFilterableColumns" ref="filterAddBtnRef" class="relative">
        <button
          type="button"
          @click="openFilterMenu"
          :class="[
            'inline-flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-control border transition-colors',
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
            class="absolute left-0 top-full mt-1 z-30 w-80 bg-card border border-card-line rounded-popover shadow-xl p-4"
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

        <!-- Spinner de refresco (reload preservando expansión) -->
        <IconLoader2 v-if="isFetching && !loading" class="size-4 text-muted-foreground animate-spin" />

        <!-- Instant + Reload SIEMPRE primero cuando infoPosition === 'none' -->
        <InfoToolbar
          v-if="infoPosition === 'none'"
          :show-reload="showReloadButton"
          :is-fetching="isFetching"
          :show-instant="isDataFromCache && cached"
          @reload="fetchInitial"
        />

        <!-- Columns dropdown -->
        <div v-if="showColumns" class="relative">
          <button
            type="button"
            @click="showColumnPanel = !showColumnPanel"
            title="Columnas"
            :class="[
              'p-1.5 inline-flex items-center justify-center rounded-control border transition-colors',
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
              class="absolute right-0 top-full mt-1 z-30 w-56 bg-card border border-card-line rounded-popover shadow-xl p-2"
              @click.stop
            >
              <p class="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Columnas ({{ visibleColumnCount }}/{{ columns.length }})
              </p>
              <ul class="mt-1 space-y-0.5">
                <li v-for="col in columns" :key="col.key">
                  <label class="flex items-center gap-2 px-2 py-1.5 rounded-control hover:bg-muted-hover cursor-pointer text-sm">
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
              'p-1.5 inline-flex items-center justify-center rounded-control border transition-colors',
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
              class="absolute right-0 top-full mt-1 z-30 w-72 bg-card border border-card-line rounded-popover shadow-xl p-3 space-y-3"
              @click.stop
            >
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">Nombre del archivo</label>
                <input
                  v-model="exportFilename"
                  type="text"
                  class="innertia-field innertia-field-sm"
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
                      'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-control border transition-colors',
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
                  class="text-xs px-3 py-1.5 rounded-control bg-primary text-primary-foreground hover:bg-primary-hover"
                >Exportar</button>
              </div>
            </div>
          </Transition>
        </div>

      </div>
    </div>

    <!-- ── Filter chips ───────────────────────────────────────────────────── -->
    <div v-if="activeFilterList.length" class="flex flex-wrap items-center gap-1.5 mb-2">
      <div
        v-for="chip in activeFilterList"
        :key="chip.key"
        class="inline-flex items-center text-xs rounded-control border border-card-line bg-card overflow-hidden"
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

    <!-- ── Table wrapper (rounded + scroll) ───────────────────────────────── -->
    <div
      :class="[
        'flex flex-col w-full',
        bordered ? 'border border-card-line rounded-card overflow-hidden' : '',
      ]"
    >
      <div class="overflow-auto" :style="sizeStyle">

        <!-- ════════════ Variante 'table' ════════════ -->
        <table v-if="variant === 'table'" class="w-full divide-y divide-card-line" style="table-layout: auto">

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
              :indeterminate-set="indeterminateSet"
              :column-visibility="columnVisibility"
              :selected-id="selectedId"
              @toggle="toggle"
              @check="toggleCheck"
              @row-click="handleRowClick"
            >
              <template v-for="col in columns" :key="col.key" #[`cell-${col.key}`]="slotProps">
                <slot :name="`cell-${col.key}`" v-bind="slotProps" />
              </template>
            </TreeNode>
          </template>
        </tbody>
        </table>

        <!-- ════════════ Variante 'list' (compacto, sin tabla) ════════════ -->
        <div v-else class="py-2">
          <!-- Loading skeleton -->
          <div v-if="loading" class="space-y-1 px-2">
            <div v-for="i in 6" :key="`sk-${i}`" class="h-7 bg-muted/60 rounded animate-pulse" :style="{ width: `${60 + (i % 3) * 10}%` }" />
          </div>

          <!-- Empty -->
          <div v-else-if="!roots.length" class="py-12 text-center text-sm text-muted-foreground">
            {{ emptyMessage }}
          </div>

          <!-- Tree -->
          <div v-else class="px-1.5">
            <TreeNode
              v-for="root in roots"
              :key="root.id"
              :node="root"
              :columns="columns"
              :depth="0"
              variant="list"
              :expanded="expandedSet"
              :loading-set="loadingSet"
              :children-by-id="childrenById"
              :row-href="rowHref"
              :clickable-rows="clickableRows"
              :name-col-key="nameColKey"
              :checkable="checkable"
              :checked-set="checkedSet"
              :indeterminate-set="indeterminateSet"
              :column-visibility="columnVisibility"
              :selected-id="selectedId"
              @toggle="toggle"
              @check="toggleCheck"
              @row-click="handleRowClick"
            >
              <template v-for="col in columns" :key="col.key" #[`cell-${col.key}`]="slotProps">
                <slot :name="`cell-${col.key}`" v-bind="slotProps" />
              </template>
            </TreeNode>
          </div>
        </div>
      </div>

      <!-- ── Footer bar (reload + total + cache badge) — top/bottom/none ── -->
      <div
        v-if="infoPosition !== 'none'"
        :class="[
          'flex flex-col sm:flex-row items-center justify-between gap-y-3 sm:gap-y-0 px-4 py-3',
          infoPosition === 'top'
            ? (bordered ? 'order-first border-b border-card-line bg-card' : 'order-first pb-4')
            : (bordered ? 'border-t border-card-line bg-card' : 'pt-4'),
        ]"
      >
        <div class="flex items-center gap-x-4 flex-wrap gap-y-2">
          <!-- Reload button -->
          <div v-if="showReloadButton" class="flex items-center gap-x-2">
            <IconReload
              v-if="!isFetching"
              class="size-4 cursor-pointer text-muted-foreground hover:text-muted-foreground-1 transition-colors"
              @click="fetchInitial"
            />
            <IconLoader2 v-else class="size-4 text-muted-foreground-2 animate-spin" />
          </div>

          <!-- Total nodes -->
          <p class="text-sm text-foreground font-medium">
            {{ totalRendered }} {{ totalRendered === 1 ? 'nodo' : 'nodos' }}
          </p>

          <!-- Cache badge (instant) -->
          <div v-if="isDataFromCache && cached" class="group relative flex items-center">
            <div class="flex items-center gap-x-1.5 py-1 px-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-badge cursor-help hover:bg-emerald-500/20 transition-colors">
              <IconBolt class="size-3.5 fill-current" />
              <span class="text-[10px] font-bold uppercase tracking-wider">Instant</span>
            </div>
            <div class="absolute bottom-full mb-2 left-0 hidden group-hover:block w-48 p-2.5 bg-slate-900 text-white text-[11px] leading-relaxed rounded-popover shadow-2xl z-50">
              <div class="font-bold mb-1 flex items-center gap-x-1.5 text-emerald-400">
                <IconBolt class="size-3" /> Datos en caché
              </div>
              Se cargaron al instante desde la memoria local. Hacé reload para sincronizar con el servidor.
              <div class="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-900"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- ↑ table wrapper cierra acá. DataPreview va FUERA como hermano. -->

    <!-- ── Preview compartido (panel overlay + chip flotante) ───────────── -->
    <DataPreview
      ref="dataPreviewRef"
      v-model:row="previewRow"
      :enabled="previewEnabled"
      :name="props.name || 'tree'"
      :cached="cached"
      :preview-href="previewHref"
      :preview-deletable="previewDeletable"
      :split-ratio="splitRatio"
      :container-ref="containerRef"
      :history-endpoint="resolvedHistoryEndpoint"
      @delete="emit('preview-delete', $event)"
    >
      <template #header="bind">
        <slot name="preview-header" v-bind="bind">
          <div class="font-semibold text-foreground truncate">{{ bind.row.name ?? 'Detalle' }}</div>
        </slot>
      </template>
      <template #actions="bind">
        <slot name="preview-actions" v-bind="bind" />
      </template>
      <template #default="bind">
        <slot name="preview" v-bind="bind" />
      </template>
    </DataPreview>

  </div>
</template>
