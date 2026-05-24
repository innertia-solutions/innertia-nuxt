<script setup>
import { IconLoader2, IconPlus } from '@tabler/icons-vue'
import { useQueryClient } from '@tanstack/vue-query'

// Kanban board: states as columns, HTML5 DnD, optimistic updates
// Usage: <TableKanban endpoint="..." :states="[{key:'todo',label:'Pendiente',color:'slate'}]" state-key="status" ... />

const props = defineProps({
  endpoint: { type: String, required: true },     // POST endpoint returning paginated list
  name: { type: String, required: true },          // used as queryKey base
  params: { type: Object, default: () => ({}) },
  stateKey: { type: String, default: 'status' },   // field in row that holds the state key
  states: {                                         // column definitions
    type: Array,
    required: true,
    // [{ key: 'todo', label: 'Pendiente', color: 'slate' }]
    // color = tailwind color name: slate|red|yellow|green|blue|indigo|purple|pink
  },
  moveMutation: { type: Function, default: null }, // (id, newState) => Promise — called on drop
  perPage: { type: Number, default: 50 },
})

const emit = defineEmits(['move', 'card-click'])

const api = useApi()
const queryClient = useQueryClient()

// ─── Fetch all rows ───────────────────────────────────────────────────────────
const loading = ref(false)
const rows = ref([])

const fetchAll = async () => {
  loading.value = true
  try {
    const res = await api.post(props.endpoint, { perPage: props.perPage, ...props.params })
    rows.value = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
  } catch (e) {
    console.error('[Kanban] fetch error', e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

watch(() => props.params, fetchAll, { deep: true })

// ─── Rows grouped by state ────────────────────────────────────────────────────
const columnRows = computed(() => {
  const map = {}
  for (const s of props.states) map[s.key] = []
  for (const row of rows.value) {
    const state = row[props.stateKey]
    if (map[state]) map[state].push(row)
  }
  return map
})

// ─── DnD ─────────────────────────────────────────────────────────────────────
const draggedId = ref(null)
const draggedFromState = ref(null)
const dragOverState = ref(null)

const onDragStart = (row, state) => {
  draggedId.value = row.id
  draggedFromState.value = state
}

const onDragOver = (e, state) => {
  e.preventDefault()
  dragOverState.value = state
}

const onDragLeave = () => { dragOverState.value = null }

const onDrop = async (targetState) => {
  dragOverState.value = null
  if (!draggedId.value || draggedFromState.value === targetState) {
    draggedId.value = null
    draggedFromState.value = null
    return
  }

  const id = draggedId.value
  const fromState = draggedFromState.value
  draggedId.value = null
  draggedFromState.value = null

  // Optimistic update
  const idx = rows.value.findIndex(r => r.id === id)
  if (idx >= 0) rows.value[idx] = { ...rows.value[idx], [props.stateKey]: targetState }

  emit('move', { id, from: fromState, to: targetState })

  if (props.moveMutation) {
    try {
      await props.moveMutation(id, targetState)
    } catch (e) {
      // Rollback
      const ridx = rows.value.findIndex(r => r.id === id)
      if (ridx >= 0) rows.value[ridx] = { ...rows.value[ridx], [props.stateKey]: fromState }
      console.error('[Kanban] move failed, rolled back', e)
    }
  }
}

// ─── Color map ────────────────────────────────────────────────────────────────
const colorMap = {
  slate:  { header: 'bg-surface text-foreground', over: 'ring-2 ring-slate-400' },
  red:    { header: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',       over: 'ring-2 ring-red-400' },
  yellow: { header: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300', over: 'ring-2 ring-yellow-400' },
  green:  { header: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300', over: 'ring-2 ring-green-400' },
  blue:   { header: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',   over: 'ring-2 ring-blue-400' },
  indigo: { header: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300', over: 'ring-2 ring-indigo-400' },
  purple: { header: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300', over: 'ring-2 ring-purple-400' },
  pink:   { header: 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300',   over: 'ring-2 ring-pink-400' },
}

const getColors = (state) => colorMap[state.color ?? 'slate'] ?? colorMap.slate

const reload = () => fetchAll()
defineExpose({ reload, rows })
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 gap-2 text-slate-400">
      <IconLoader2 class="size-5 animate-spin" stroke="1.5" />
      <span class="text-sm">Cargando...</span>
    </div>

    <!-- Board -->
    <div v-else class="flex gap-4 overflow-x-auto pb-4">
      <div
        v-for="state in states"
        :key="state.key"
        class="flex-shrink-0 w-72 flex flex-col rounded-xl border border-card-line overflow-hidden transition-shadow"
        :class="dragOverState === state.key ? getColors(state).over : ''"
        @dragover="onDragOver($event, state.key)"
        @dragleave="onDragLeave"
        @drop="onDrop(state.key)"
      >
        <!-- Column header -->
        <div :class="['px-4 py-3 flex items-center justify-between', getColors(state).header]">
          <span class="font-semibold text-sm">{{ state.label }}</span>
          <span class="text-xs font-bold bg-white/60 dark:bg-black/20 rounded-full px-2 py-0.5">
            {{ columnRows[state.key]?.length ?? 0 }}
          </span>
        </div>

        <!-- Cards -->
        <div class="flex-1 flex flex-col gap-2 p-3 bg-muted min-h-24">
          <div
            v-for="row in columnRows[state.key]"
            :key="row.id"
            draggable="true"
            @dragstart="onDragStart(row, state.key)"
            class="bg-card border border-card-line rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
            :class="draggedId === row.id ? 'opacity-40' : ''"
            @click="emit('card-click', row)"
          >
            <slot name="card" :row="row" :state="state">
              <!-- Default card -->
              <div class="space-y-1">
                <div
                  v-for="(val, key) in Object.fromEntries(Object.entries(row).filter(([k]) => k !== props.stateKey).slice(0, 3))"
                  :key="key"
                  class="text-sm"
                >
                  <span class="text-muted-foreground text-xs capitalize">{{ key }}: </span>
                  <span class="text-foreground font-medium">{{ val }}</span>
                </div>
              </div>
            </slot>
          </div>

          <div
            v-if="!columnRows[state.key]?.length"
            class="flex-1 flex items-center justify-center py-6 text-sm text-muted-foreground-2"
          >
            Sin elementos
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
