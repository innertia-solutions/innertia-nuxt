<script setup>
import { IconChevronDown, IconChevronRight, IconLoader2, IconSearch } from '@tabler/icons-vue'

const props = defineProps({
  // Required: backend route that returns DataTree-shaped responses.
  endpoint: { type: String, required: true },

  // Columns shape (compatible with Table.Standard): { key, label, sortable?, size? }
  // The first column is the "name" column and gets indented + chevron.
  columns:  { type: Array, required: true },

  // Optional name (for cache keys / preferences — not used in v1).
  name:     { type: String, default: '' },

  // Extra body params merged into the request.
  params:   { type: Object, default: () => ({}) },

  // Search input.
  showSearch:        { type: Boolean, default: true },
  searchPlaceholder: { type: String,  default: 'Buscar...' },

  // Row interaction.
  rowHref:    { type: [String, Function], default: null },  // (row) => path
  clickableRows: { type: Boolean, default: true },

  // Empty state.
  emptyMessage: { type: String, default: 'No hay registros.' },
})

const emit = defineEmits(['row-click', 'loaded', 'expand'])

const api = useApi()

// ─── State ────────────────────────────────────────────────────────────────────
const roots       = ref([])
const meta        = ref(null)
const loading     = ref(false)
const isFetching  = ref(false)
const search      = ref('')
const expandedSet = ref(new Set())    // node ids
const loadingSet  = ref(new Set())    // node ids currently fetching children
const childrenById = ref({})          // id -> array (cached lazy responses)

// ─── Fetching ─────────────────────────────────────────────────────────────────
const buildBody = (extra = {}) => ({
  ...props.params,
  search: search.value.trim(),
  ...extra,
})

const fetchInitial = async () => {
  loading.value = true
  isFetching.value = true
  try {
    const res = await api.post(props.endpoint, buildBody())
    roots.value = res?.data ?? []
    meta.value  = res?.meta ?? null
    childrenById.value = {}   // reset cache on new search/initial
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
  if (childrenById.value[nodeId]) return       // ya cargado
  if (loadingSet.value.has(nodeId)) return     // ya cargando
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

// ─── Toggle expand ────────────────────────────────────────────────────────────
const toggle = async (node) => {
  const id = node.id
  const next = new Set(expandedSet.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
    // Si el nodo tiene `children` ya cargado, no pedimos.
    // Si está en el último nivel (sin `children` key) y has_children: hacemos lazy fetch.
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

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(fetchInitial)

// Public API (parent can call ref.value.refresh())
defineExpose({
  refresh: fetchInitial,
})

// ─── Row click ────────────────────────────────────────────────────────────────
const onRowClick = (node) => {
  emit('row-click', node)
}

const hrefFor = (node) => {
  if (!props.rowHref) return null
  return typeof props.rowHref === 'function' ? props.rowHref(node) : props.rowHref
}

const nameColumn = computed(() => props.columns[0])
const restColumns = computed(() => props.columns.slice(1))

// Column widths (proportional) — simple uniform; el primero crece más
const gridTemplateColumns = computed(() => {
  const rest = restColumns.value.length
  return `minmax(280px, 2fr) ${'1fr '.repeat(rest)}`.trim()
})
</script>

<template>
  <div class="bg-card border border-card-line rounded-xl overflow-hidden">

    <!-- Toolbar: search -->
    <div v-if="showSearch" class="p-3 border-b border-card-line">
      <div class="relative max-w-md">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          v-model="search"
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full pl-9 pr-3 py-2 text-sm bg-background border border-card-line rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
        <IconLoader2
          v-if="isFetching && !loading"
          class="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground"
        />
      </div>
    </div>

    <!-- Header row -->
    <div
      class="grid items-center gap-x-4 px-3 py-2 border-b border-card-line bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
      :style="{ gridTemplateColumns }"
    >
      <div>{{ nameColumn?.label ?? 'Nombre' }}</div>
      <div v-for="col in restColumns" :key="col.key">{{ col.label }}</div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
      <IconLoader2 class="size-5 animate-spin mr-2" /> Cargando…
    </div>

    <!-- Empty -->
    <div v-else-if="!roots.length" class="py-12 text-center text-sm text-muted-foreground">
      {{ emptyMessage }}
    </div>

    <!-- Tree body -->
    <ul v-else class="py-1">
      <TreeNode
        v-for="root in roots"
        :key="root.id"
        :node="root"
        :columns="columns"
        :depth="0"
        :expanded="expandedSet"
        :loading-set="loadingSet"
        :children-by-id="childrenById"
        :grid-template-columns="gridTemplateColumns"
        :row-href="rowHref"
        :clickable-rows="clickableRows"
        @toggle="toggle"
        @row-click="onRowClick"
      >
        <template v-for="col in columns" :key="col.key" #[`cell-${col.key}`]="slotProps">
          <slot :name="`cell-${col.key}`" v-bind="slotProps" />
        </template>
      </TreeNode>
    </ul>
  </div>
</template>
