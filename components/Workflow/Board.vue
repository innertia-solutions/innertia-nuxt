<script setup>
import { ref, computed, markRaw } from 'vue'
import {
  IconLayoutKanban, IconTable, IconGitBranch, IconChartBar,
} from '@tabler/icons-vue'

/**
 * WorkflowBoard — vista unificada de un workflow con switcher de modos.
 *
 * Recibe una definición y los items (o los resultados de useWorkflowView)
 * y renderiza la vista activa: kanban / table / flow / funnel.
 *
 * Diseñado para ser delgado: delega el estado al composable useWorkflowView
 * que el consumer instancia y pasa como props.
 */

const props = defineProps({
  /** { steps, transitions } — WorkflowDefinition.config */
  definition:    { type: Object, required: true },
  /** Array de items con un campo stateKey */
  items:         { type: Array,  default: () => [] },
  /** Campo del item que indica el step actual */
  stateKey:      { type: String, default: 'current_step' },
  /** Columnas derivadas (de useWorkflowView.columns) */
  columns:       { type: Array,  default: null },
  /** Función de movimiento validada (de useWorkflowView.onMove) */
  onMove:        { type: Function, default: null },
  /** Datos para el funnel (de useWorkflowView.funnelData) */
  funnelData:    { type: Array,  default: null },
  /** Modo de vista activo */
  viewMode:      { type: String, default: 'kanban' },
  /** Loading state */
  loading:       { type: Boolean, default: false },
  /** Vistas disponibles */
  views:         { type: Array, default: () => ['kanban', 'table', 'flow', 'funnel'] },
  /** Opciones extra para pasar a KanbanStandard */
  kanbanProps:   { type: Object, default: () => ({}) },
  /** Opciones extra para pasar a TableStandard */
  tableProps:    { type: Object, default: () => ({}) },
  /** Nombre para persistencia (igual que en KanbanStandard / TableStandard) */
  name:          { type: String, default: '' },
})

const emit = defineEmits(['update:viewMode', 'move', 'row-click'])

// ── Vistas disponibles ────────────────────────────────────────────────────────

const VIEW_META = [
  { id: 'kanban',  label: 'Kanban',    icon: markRaw(IconLayoutKanban) },
  { id: 'table',   label: 'Tabla',     icon: markRaw(IconTable)        },
  { id: 'flow',    label: 'Flujo',     icon: markRaw(IconGitBranch)    },
  { id: 'funnel',  label: 'Embudo',    icon: markRaw(IconChartBar)     },
]

const activeViews = computed(() =>
  VIEW_META.filter(v => props.views.includes(v.id))
)

const setView = (id) => emit('update:viewMode', id)

// ── Columnas derivadas (fallback si no se pasan) ───────────────────────────────

const STEP_TYPE_COLOR = {
  start:          'slate',
  in_progress:    'blue',
  pause_internal: 'amber',
  pause_external: 'orange',
  finished:       'green',
  cancelled:      'red',
}

const resolvedColumns = computed(() =>
  props.columns ?? (props.definition?.steps ?? []).map(step => ({
    key:   step.key,
    label: step.label,
    color: STEP_TYPE_COLOR[step.type] ?? 'slate',
    type:  step.type,
  }))
)

// ── DnD ──────────────────────────────────────────────────────────────────────

const draggedId   = ref(null)
const draggedFrom = ref(null)
const dragOverCol = ref(null)

const onDragStart = (item, colKey) => {
  draggedId.value   = item.id
  draggedFrom.value = colKey
}
const onDragOver  = (e, colKey) => { e.preventDefault(); dragOverCol.value = colKey }
const onDragLeave = (e) => {
  // Ignorar si el mouse sigue dentro del mismo column (hijo → padre)
  if (!e.currentTarget.contains(e.relatedTarget)) dragOverCol.value = null
}
const onDrop = async (targetCol) => {
  dragOverCol.value = null
  const id   = draggedId.value
  const from = draggedFrom.value
  draggedId.value   = null
  draggedFrom.value = null
  if (!id || from === targetCol) return
  await moveMutation(id, targetCol)
}

// ── Color map para drag-over highlight ────────────────────────────────────────

const COLOR_OVER = {
  slate:  'ring-2 ring-slate-400/60',
  blue:   'ring-2 ring-blue-400/60',
  amber:  'ring-2 ring-amber-400/60',
  orange: 'ring-2 ring-orange-400/60',
  green:  'ring-2 ring-green-400/60',
  red:    'ring-2 ring-red-400/60',
  violet: 'ring-2 ring-violet-400/60',
}

const COLOR_DOT = {
  slate:  'bg-slate-400',
  blue:   'bg-blue-500',
  amber:  'bg-amber-500',
  orange: 'bg-orange-500',
  green:  'bg-green-500',
  red:    'bg-red-500',
  violet: 'bg-violet-500',
}

// ── Move mutation ─────────────────────────────────────────────────────────────

const moveMutation = async (id, toStep) => {
  const item     = props.items.find(i => i.id === id)
  const fromStep = item?.[props.stateKey]
  if (props.onMove) {
    const ok = await props.onMove(id, toStep, fromStep)
    if (ok !== false) emit('move', { id, from: fromStep, to: toStep })
    return ok
  }
  emit('move', { id, from: fromStep, to: toStep })
}

// ── Funnel series para Chart ──────────────────────────────────────────────────

const funnelSeries = computed(() => {
  const data = props.funnelData ?? resolvedColumns.value.map(col => ({
    key:   col.key,
    label: col.label,
    count: props.items.filter(i => i[props.stateKey] === col.key).length,
  }))
  return [{
    name: 'Items',
    data: data.map(d => d.count),
  }]
})

const funnelCategories = computed(() => {
  const data = props.funnelData ?? resolvedColumns.value
  return data.map(d => d.label)
})
</script>

<template>
  <div class="flex flex-col h-full min-h-0">

    <!-- ── Toolbar con switcher ──────────────────────────────────────────────── -->
    <div class="flex items-center gap-3 px-3 py-2 border-b border-card-line bg-surface shrink-0">

      <!-- View switcher -->
      <div class="inline-flex items-center rounded-control border border-card-line bg-card overflow-hidden">
        <button
          v-for="view in activeViews"
          :key="view.id"
          type="button"
          @click="setView(view.id)"
          :title="view.label"
          :class="[
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
            viewMode === view.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted-hover',
          ]"
        >
          <component :is="view.icon" :size="14" :stroke="1.75" />
          <span class="hidden sm:inline">{{ view.label }}</span>
        </button>
      </div>

      <!-- Slot para toolbar extra del consumer -->
      <slot name="toolbar" :view-mode="viewMode" :columns="resolvedColumns" />

      <div class="flex-1" />

      <!-- Loading indicator -->
      <div v-if="loading" class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="12" />
        </svg>
        Cargando…
      </div>
    </div>

    <!-- ── Vistas ────────────────────────────────────────────────────────────── -->
    <div class="flex-1 min-h-0 overflow-hidden">

      <!-- KANBAN -->
      <template v-if="viewMode === 'kanban'">
        <slot
          name="kanban"
          :columns="resolvedColumns"
          :items="items"
          :move-mutation="moveMutation"
          :state-key="stateKey"
          :on-drag-start="onDragStart"
          :on-drag-over="onDragOver"
          :on-drag-leave="onDragLeave"
          :on-drop="onDrop"
        >
          <!-- Default: kanban con DnD HTML5 -->
          <div class="h-full overflow-x-auto">
            <div class="flex gap-3 p-3 h-full min-w-max items-start">
              <div
                v-for="col in resolvedColumns"
                :key="col.key"
                class="flex flex-col w-72 shrink-0 rounded-card bg-muted/50 overflow-hidden transition-shadow"
                :class="dragOverCol === col.key ? (COLOR_OVER[col.color] ?? COLOR_OVER.slate) : ''"
                @dragover="onDragOver($event, col.key)"
                @dragleave="onDragLeave($event)"
                @drop="onDrop(col.key)"
              >
                <!-- Column header -->
                <div class="flex items-center justify-between px-3 py-2.5">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full shrink-0" :class="COLOR_DOT[col.color] ?? 'bg-slate-400'" />
                    <span class="text-[11px] font-semibold text-foreground uppercase tracking-wider">{{ col.label }}</span>
                  </div>
                  <span class="text-[11px] font-semibold text-muted-foreground bg-card/70 rounded-badge px-2 py-0.5 tabular-nums">
                    {{ items.filter(i => i[stateKey] === col.key).length }}
                  </span>
                </div>

                <!-- Cards drop zone -->
                <div class="flex-1 overflow-y-auto max-h-[calc(100%-2.75rem)] flex flex-col gap-2 p-2 min-h-16">
                  <div
                    v-for="item in items.filter(i => i[stateKey] === col.key)"
                    :key="item.id"
                    draggable="true"
                    @dragstart="onDragStart(item, col.key)"
                    @click="emit('row-click', item)"
                    class="bg-card rounded-card border border-card-line p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition-all select-none"
                    :class="draggedId === item.id ? 'opacity-40' : ''"
                  >
                    <slot name="card" :item="item" :column="col">
                      <p class="text-sm font-medium text-foreground truncate">{{ item.title ?? item.name ?? item.id }}</p>
                      <p class="text-xs text-muted-foreground font-mono mt-1">{{ item.id?.slice(0, 8) }}</p>
                    </slot>
                  </div>

                  <div
                    v-if="!items.filter(i => i[stateKey] === col.key).length"
                    class="flex-1 flex items-center justify-center py-4 text-xs text-muted-foreground-2 italic"
                  >
                    Vacío
                  </div>
                </div>
              </div>
            </div>
          </div>
        </slot>
      </template>

      <!-- TABLE -->
      <template v-if="viewMode === 'table'">
        <slot name="table" :columns="resolvedColumns" :items="items" :state-key="stateKey">
          <!-- Tabla simple de fallback -->
          <div class="h-full overflow-auto p-4">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-card-line">
                  <th class="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID</th>
                  <th class="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre</th>
                  <th class="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step actual</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-card-line/50">
                <tr
                  v-for="item in items"
                  :key="item.id"
                  class="hover:bg-layer-hover cursor-pointer transition-colors"
                  @click="emit('row-click', item)"
                >
                  <td class="py-2 px-3 font-mono text-xs text-muted-foreground">{{ item.id?.slice(0, 8) }}</td>
                  <td class="py-2 px-3 text-foreground">{{ item.title ?? item.name ?? '—' }}</td>
                  <td class="py-2 px-3">
                    <span class="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-badge bg-muted text-foreground">
                      {{ resolvedColumns.find(c => c.key === item[stateKey])?.label ?? item[stateKey] ?? '—' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </slot>
      </template>

      <!-- FLOW -->
      <template v-if="viewMode === 'flow'">
        <slot name="flow" :definition="definition" :items="items" :state-key="stateKey">
          <WorkflowViewer
            :definition="definition"
            class="h-full"
          />
        </slot>
      </template>

      <!-- FUNNEL -->
      <template v-if="viewMode === 'funnel'">
        <slot name="funnel" :funnel-data="funnelData" :columns="resolvedColumns">
          <div class="h-full overflow-auto p-6">
            <div class="max-w-2xl mx-auto space-y-3">
              <p class="text-sm font-medium text-foreground mb-4">Distribución por step</p>
              <div
                v-for="(col, idx) in resolvedColumns"
                :key="col.key"
                class="flex items-center gap-3"
              >
                <span class="text-xs text-muted-foreground w-32 truncate text-right shrink-0">{{ col.label }}</span>
                <div class="flex-1 h-8 bg-surface rounded-control border border-card-line overflow-hidden">
                  <div
                    :style="{
                      width: items.length > 0
                        ? Math.max(4, (items.filter(i => i[stateKey] === col.key).length / items.length) * 100) + '%'
                        : '0%',
                    }"
                    :class="[
                      'h-full transition-all duration-500 rounded-control',
                      col.color === 'blue'   ? 'bg-blue-400/70 dark:bg-blue-600/60'   :
                      col.color === 'green'  ? 'bg-green-400/70 dark:bg-green-600/60'  :
                      col.color === 'amber'  ? 'bg-amber-400/70 dark:bg-amber-600/60'  :
                      col.color === 'orange' ? 'bg-orange-400/70 dark:bg-orange-600/60':
                      col.color === 'red'    ? 'bg-red-400/70 dark:bg-red-600/60'      :
                      col.color === 'violet' ? 'bg-violet-400/70 dark:bg-violet-600/60':
                      'bg-slate-400/70 dark:bg-slate-600/60'
                    ]"
                  />
                </div>
                <span class="text-xs font-semibold text-foreground tabular-nums w-8 shrink-0">
                  {{ items.filter(i => i[stateKey] === col.key).length }}
                </span>
              </div>
            </div>
          </div>
        </slot>
      </template>

    </div>
  </div>
</template>
