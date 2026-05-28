<script setup>
import {
  IconLoader2, IconSearch, IconBolt, IconReload, IconPlus, IconLayoutColumns,
  IconChevronDown, IconX,
} from '@tabler/icons-vue'
import Forms from '../Forms/Input.vue'

/**
 * <KanbanStandard> — Kanban board polished, paralelo a Table.Standard / Tree.Standard.
 *
 * Replica el patrón: toolbar (search + columns + reload) + footer (total + cache badge)
 * + preview overlay vía <DataPreview>. Estados como columnas, DnD HTML5, optimistic
 * updates, click en card abre preview.
 *
 * Dos modos de uso:
 *
 * 1) Endpoint mode (fetch interno):
 *   <KanbanStandard
 *     name="tasks"
 *     endpoint="backoffice/tasks"
 *     state-key="status"
 *     :states="[...]"
 *     :move-mutation="(id, state) => api.patch(...)"
 *   />
 *
 * 2) Items mode (datos pre-cargados, sin fetch):
 *   <KanbanStandard
 *     :items="myItems"
 *     state-key="current_step"
 *     :states="columns"
 *     :move-mutation="onMove"
 *     :search-keys="['title', 'assignee']"
 *   />
 *
 * En items mode: la búsqueda filtra localmente, reload re-aplica el filtro,
 * y moveMutation puede retornar false para indicar transición bloqueada.
 */

const slots = useSlots()

const props = defineProps({
  // ── Modo endpoint (fetch interno) ─────────────────────────────────────────
  endpoint:  { type: String,  default: null },
  name:      { type: String,  default: '' },
  params:    { type: Object,  default: () => ({}) },
  perPage:   { type: Number,  default: 100 },

  // ── Modo items pre-cargados (sin fetch) ───────────────────────────────────
  // Cuando se pasa `items`, el componente NO hace fetch. La búsqueda filtra
  // localmente usando los campos definidos en searchKeys.
  items:      { type: Array,            default: null },
  searchKeys: { type: [String, Array],  default: () => ['name', 'title'] },

  // ── Común ─────────────────────────────────────────────────────────────────
  stateKey:  { type: String, default: 'status' },
  states:    { type: Array,  required: true },
  moveMutation: { type: Function, default: null },

  // Toolbar visibility
  showSearch:       { type: Boolean, default: true },
  searchPlaceholder:{ type: String,  default: 'Buscar...' },
  showColumns:      { type: Boolean, default: true },
  showReloadButton: { type: Boolean, default: true },
  showAddButton:    { type: Boolean, default: false },

  // Caché en sessionStorage
  cached: { type: Boolean, default: false },

  // Modo visual:
  //   bordered=true  (default) → wrapper con border + rounded-card, columnas con border
  //   bordered=false           → sin bordes, columnas con bg sutil tipo Trello
  bordered: { type: Boolean, default: true },

  // Posición de la barra de info (reload + total + instant badge):
  //   'bottom' (default) → footer debajo del board
  //   'top'              → footer arriba del board (sobre la tabla)
  //   'none'             → sin footer; reload + instant compactos al lado del botón columnas
  infoPosition: { type: String, default: 'bottom' },

  // Tamaño visible del board y de las columnas internas.
  //   'sm' | 'md' (default) | 'lg' | 'fit' (delegado al padre)
  size: { type: String, default: 'md' },

  // Preview overlay (mismo patrón que Table/Tree)
  previewHref:      { type: [String, Function], default: null },
  previewDeletable: { type: Boolean, default: false },
  autoClosePreview: { type: Boolean, default: true },
  splitRatio:       { type: Number,  default: 55 },
})

const emit = defineEmits([
  'card-click', 'move', 'loaded', 'preview-delete', 'add',
])

const sizeStyle = computed(() => {
  switch (props.size) {
    case 'sm':  return { minHeight: '18rem' }
    case 'lg':  return { minHeight: '45rem' }
    case 'fit': return {}
    case 'md':
    default:    return { minHeight: '30rem' }
  }
})

const columnMaxH = computed(() => {
  switch (props.size) {
    case 'sm':  return 'max-h-[40vh]'
    case 'lg':  return 'max-h-[75vh]'
    case 'fit': return ''
    case 'md':
    default:    return 'max-h-[60vh]'
  }
})

const api = useApi()

// ─── Modo ─────────────────────────────────────────────────────────────────────
// isItemsMode=true  → datos pre-cargados vía prop `items`
// isItemsMode=false → fetch interno vía `endpoint`
const isItemsMode = computed(() => props.items !== null)

// ─── State ───────────────────────────────────────────────────────────────────
const rows         = ref([])
const meta         = ref(null)
const loading      = ref(false)
const isFetching   = ref(false)
const search       = ref('')
const isDataFromCache = ref(false)

// Visibilidad de columnas (estados) — { [stateKey]: boolean }
const stateVisibility = ref(Object.fromEntries(props.states.map(s => [s.key, true])))
const visibleStates   = computed(() => props.states.filter(s => stateVisibility.value[s.key] !== false))

// ─── Items mode: filtro local ────────────────────────────────────────────────

const applyLocalFilter = () => {
  const source = props.items ?? []
  const q      = search.value.trim().toLowerCase()
  if (!q) {
    rows.value = [...source]
    return
  }
  const keys = Array.isArray(props.searchKeys) ? props.searchKeys : [props.searchKeys]
  rows.value = source.filter(item =>
    keys.some(k => String(item[k] ?? '').toLowerCase().includes(q))
  )
}

// Sincronizar rows cada vez que cambien los items externos
watch(
  () => props.items,
  () => { if (isItemsMode.value) applyLocalFilter() },
  { deep: true, immediate: true },
)

// ─── Fetch (endpoint mode) ───────────────────────────────────────────────────
const cacheKey = computed(() => {
  if (!props.cached || !props.name) return null
  return `kanban_${props.name}`
})

const buildBody = () => ({
  ...props.params,
  per_page: props.perPage,
  search:   search.value.trim(),
})

const fetchAll = async () => {
  // En items mode no hay fetch — solo re-aplica el filtro local
  if (isItemsMode.value) { applyLocalFilter(); return }

  loading.value = true
  isFetching.value = true
  isDataFromCache.value = false
  try {
    const res = await api.post(props.endpoint, buildBody())
    rows.value = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
    meta.value = res?.meta ?? null
    saveToCache()
    emit('loaded', res)
  } catch (e) {
    console.error('[KanbanStandard] fetch error:', e)
    rows.value = []
  } finally {
    loading.value = false
    isFetching.value = false
  }
}

const saveToCache = () => {
  if (!cacheKey.value) return
  try {
    sessionStorage.setItem(cacheKey.value, JSON.stringify({
      rows: rows.value,
      meta: meta.value,
      stateVisibility: stateVisibility.value,
      search: search.value,
      timestamp: Date.now(),
    }))
  } catch (_) { /* quota exceeded, ignore */ }
}

const loadFromCache = () => {
  if (!cacheKey.value) return false
  try {
    const raw = sessionStorage.getItem(cacheKey.value)
    if (!raw) return false
    const cached = JSON.parse(raw)
    if (Date.now() - cached.timestamp > 10 * 60 * 1000) {
      sessionStorage.removeItem(cacheKey.value)
      return false
    }
    rows.value = cached.rows ?? []
    meta.value = cached.meta ?? null
    stateVisibility.value = cached.stateVisibility ?? stateVisibility.value
    search.value = cached.search ?? ''
    isDataFromCache.value = true
    return true
  } catch { return false }
}

// Search debounced — en items mode filtra local, en endpoint mode re-fetcha
let searchTimer = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (isItemsMode.value) applyLocalFilter()
    else fetchAll()
  }, 250)
})

// ─── Rows agrupados por estado ──────────────────────────────────────────────
const columnRows = computed(() => {
  const map = {}
  for (const s of props.states) map[s.key] = []
  for (const row of rows.value) {
    const state = row[props.stateKey]
    if (map[state]) map[state].push(row)
  }
  return map
})

const totalRendered = computed(() => rows.value.length)

// ─── DnD ─────────────────────────────────────────────────────────────────────
const draggedId      = ref(null)
const draggedFrom    = ref(null)
const dragOverState  = ref(null)

const onDragStart = (row, state) => {
  draggedId.value = row.id
  draggedFrom.value = state
}
const onDragOver  = (e, state) => { e.preventDefault(); dragOverState.value = state }
const onDragLeave = () => { dragOverState.value = null }

const onDrop = async (targetState) => {
  dragOverState.value = null
  const id        = draggedId.value
  const fromState = draggedFrom.value
  draggedId.value   = null
  draggedFrom.value = null
  if (!id || fromState === targetState) return

  // Optimistic update local (solo en endpoint mode).
  // En items mode el optimistic lo gestiona el moveMutation externo
  // (ej. useWorkflowView.onMove), y rows se sincroniza vía el watcher.
  if (!isItemsMode.value) {
    const idx = rows.value.findIndex(r => r.id === id)
    if (idx >= 0) rows.value[idx] = { ...rows.value[idx], [props.stateKey]: targetState }
  }

  emit('move', { id, from: fromState, to: targetState })

  if (props.moveMutation) {
    try {
      const ok = await props.moveMutation(id, targetState)
      // Si retorna false = transición bloqueada (ej. workflow sin esa transición)
      if (ok === false && !isItemsMode.value) {
        const ridx = rows.value.findIndex(r => r.id === id)
        if (ridx >= 0) rows.value[ridx] = { ...rows.value[ridx], [props.stateKey]: fromState }
      }
    } catch (e) {
      // Rollback por error
      if (!isItemsMode.value) {
        const ridx = rows.value.findIndex(r => r.id === id)
        if (ridx >= 0) rows.value[ridx] = { ...rows.value[ridx], [props.stateKey]: fromState }
      }
      console.error('[KanbanStandard] move failed, rolled back:', e)
    }
  }
}

// ─── Columns popover ─────────────────────────────────────────────────────────
const showColumnPanel = ref(false)
const toggleColumnPanel = () => { showColumnPanel.value = !showColumnPanel.value }

// ─── Color map (tokens-aware) ────────────────────────────────────────────────
const colorMap = {
  slate:  { dot: 'bg-slate-400',   over: 'ring-2 ring-slate-400' },
  red:    { dot: 'bg-red-500',     over: 'ring-2 ring-red-400' },
  yellow: { dot: 'bg-yellow-500',  over: 'ring-2 ring-yellow-400' },
  amber:  { dot: 'bg-amber-500',   over: 'ring-2 ring-amber-400' },
  green:  { dot: 'bg-emerald-500', over: 'ring-2 ring-emerald-400' },
  blue:   { dot: 'bg-blue-500',    over: 'ring-2 ring-blue-400' },
  indigo: { dot: 'bg-indigo-500',  over: 'ring-2 ring-indigo-400' },
  purple: { dot: 'bg-purple-500',  over: 'ring-2 ring-purple-400' },
  pink:   { dot: 'bg-pink-500',    over: 'ring-2 ring-pink-400' },
}
const getColors = (state) => colorMap[state.color ?? 'slate'] ?? colorMap.slate

// ─── Preview ─────────────────────────────────────────────────────────────────
const previewEnabled  = computed(() => !!slots.preview)
const previewRow      = ref(null)
const containerRef    = ref(null)
const dataPreviewRef  = ref(null)
const closePreview    = () => { previewRow.value = null }

const { collapseDock } = useDockedPreviews()

const handleCardClick = (row) => {
  emit('card-click', row)
  if (!previewEnabled.value) return
  if (previewRow.value?.id === row.id) return
  collapseDock()
  previewRow.value = row
}

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

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(() => {
  window.addEventListener('keydown', onEsc)
  document.addEventListener('mousedown', onDocMousedown)
  if (isItemsMode.value) return   // rows ya cargados por el watcher immediate
  if (loadFromCache()) return
  fetchAll()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEsc)
  document.removeEventListener('mousedown', onDocMousedown)
})

defineExpose({ reload: fetchAll, rows })
</script>

<template>
  <div class="relative" ref="containerRef">

    <!-- ── Toolbar ─────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <!-- Search -->
      <div v-if="showSearch" class="flex-1 min-w-48 max-w-xs">
        <Forms v-model="search" type="text" :placeholder="searchPlaceholder" :icon-right="IconSearch" size="sm" />
      </div>

      <!-- + Nuevo -->
      <button
        v-if="showAddButton"
        type="button"
        @click="emit('add')"
        class="inline-flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-control bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
      >
        <IconPlus class="size-3.5" /> Nuevo
      </button>

      <!-- Reload + Instant compactos (cuando infoPosition === 'none') -->
      <InfoToolbar
        v-if="infoPosition === 'none'"
        class="ml-auto"
        :show-reload="showReloadButton"
        :is-fetching="isFetching"
        :show-instant="isDataFromCache && cached"
        @reload="fetchAll"
      />

      <!-- Columnas (estados) visibility -->
      <div v-if="showColumns" :class="['relative', infoPosition === 'none' ? '' : 'ml-auto']">
        <button
          type="button"
          @click="toggleColumnPanel"
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
            class="absolute right-0 top-full mt-1 z-30 w-56 bg-dropdown border border-dropdown-line rounded-popover shadow-xl p-2"
          >
            <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 py-1">Columnas visibles</p>
            <label
              v-for="state in states"
              :key="state.key"
              class="flex items-center gap-2 px-2 py-1.5 rounded-control hover:bg-muted-hover cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                :checked="stateVisibility[state.key] !== false"
                @change="stateVisibility[state.key] = $event.target.checked"
                class="size-4 rounded border-card-line text-primary"
              />
              <span class="size-2 rounded-avatar" :class="getColors(state).dot" />
              <span class="text-foreground">{{ state.label }}</span>
            </label>
          </div>
        </Transition>
      </div>
    </div>

    <!-- ── Board wrapper (rounded, con scroll horizontal) ─────────────── -->
    <div
      :class="[
        'flex flex-col',
        bordered ? 'border border-card-line rounded-card overflow-hidden' : '',
      ]"
    >
      <div
        :class="['overflow-x-auto', bordered ? 'p-3' : '']"
        :style="sizeStyle"
      >
        <div v-if="loading && !rows.length" class="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <IconLoader2 class="size-5 animate-spin" stroke="1.5" />
          <span class="text-sm">Cargando...</span>
        </div>

        <div v-else class="flex gap-3 items-start">
          <div
            v-for="state in visibleStates"
            :key="state.key"
            :class="[
              'flex-shrink-0 w-72 flex flex-col overflow-hidden transition-shadow',
              bordered
                ? 'rounded-card border border-card-line bg-card'
                : 'rounded-card bg-muted/50',
              dragOverState === state.key ? getColors(state).over : '',
            ]"
            @dragover="onDragOver($event, state.key)"
            @dragleave="onDragLeave"
            @drop="onDrop(state.key)"
          >
            <!-- Column header -->
            <div
              :class="[
                'px-3 py-2.5 flex items-center justify-between',
                bordered ? 'bg-card border-b border-card-line' : '',
              ]"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="size-2 rounded-avatar shrink-0" :class="getColors(state).dot" />
                <span class="font-medium text-sm text-foreground truncate uppercase tracking-wider text-[11px]">{{ state.label }}</span>
              </div>
              <span
                :class="[
                  'text-[11px] font-semibold rounded-badge px-2 py-0.5',
                  bordered ? 'text-muted-foreground bg-muted' : 'text-muted-foreground bg-card/70',
                ]"
              >
                {{ columnRows[state.key]?.length ?? 0 }}
              </span>
            </div>

            <!-- Cards -->
            <div
              :class="[
                'flex-1 flex flex-col gap-2 p-2 min-h-32 overflow-y-auto',
                columnMaxH,
                bordered ? 'bg-muted/40' : '',
              ]"
            >
              <div
                v-for="row in columnRows[state.key]"
                :key="row.id"
                draggable="true"
                @dragstart="onDragStart(row, state.key)"
                @click="handleCardClick(row)"
                class="bg-card border border-card-line rounded-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition-all select-none"
                :class="[
                  draggedId === row.id ? 'opacity-40' : '',
                  previewRow?.id === row.id ? 'ring-2 ring-primary/30' : '',
                ]"
              >
                <slot name="card" :row="row" :state="state">
                  <div class="space-y-1">
                    <p class="text-sm font-medium text-foreground truncate">{{ row.name ?? row.title ?? row.id }}</p>
                    <p v-if="row.description" class="text-xs text-muted-foreground line-clamp-2">{{ row.description }}</p>
                  </div>
                </slot>
              </div>

              <div
                v-if="!columnRows[state.key]?.length"
                class="flex-1 flex items-center justify-center py-6 text-xs text-muted-foreground-2"
              >
                Vacío
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Footer (top o bottom via CSS order, oculto en 'none') ───── -->
      <div
        v-if="infoPosition !== 'none'"
        :class="[
          'flex items-center justify-between gap-2 px-4 py-3',
          infoPosition === 'top'
            ? (bordered ? 'order-first border-b border-card-line bg-card' : 'order-first pb-4')
            : (bordered ? 'border-t border-card-line bg-card' : 'pt-4'),
        ]"
      >
        <div class="flex items-center gap-x-4 flex-wrap gap-y-2">
          <div v-if="showReloadButton" class="flex items-center gap-x-2">
            <IconReload
              v-if="!isFetching"
              class="size-4 cursor-pointer text-muted-foreground hover:text-muted-foreground-1 transition-colors"
              @click="fetchAll"
            />
            <IconLoader2 v-else class="size-4 text-muted-foreground-2 animate-spin" />
          </div>

          <p class="text-sm text-foreground font-medium">{{ totalRendered }} {{ totalRendered === 1 ? 'tarjeta' : 'tarjetas' }}</p>

          <div v-if="isDataFromCache && cached" class="group relative flex items-center">
            <div class="flex items-center gap-x-1.5 py-1 px-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-badge cursor-help hover:bg-emerald-500/20 transition-colors">
              <IconBolt class="size-3.5 fill-current" />
              <span class="text-[10px] font-bold uppercase tracking-wider">Instant</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Preview compartido (panel overlay + chip flotante + history) ── -->
    <DataPreview
      ref="dataPreviewRef"
      v-model:row="previewRow"
      :enabled="previewEnabled"
      :name="props.name || 'kanban'"
      :cached="cached"
      :preview-href="previewHref"
      :preview-deletable="previewDeletable"
      :split-ratio="splitRatio"
      :container-ref="containerRef"
      :history-endpoint="meta?.has_history && previewRow?.id && meta?.entity_type ? `history/${meta.entity_type}/${previewRow.id}` : null"
      @delete="emit('preview-delete', $event)"
    >
      <template #header="bind">
        <slot name="preview-header" v-bind="bind">
          <div class="font-semibold text-foreground truncate">{{ bind.row.name ?? bind.row.title ?? 'Detalle' }}</div>
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
