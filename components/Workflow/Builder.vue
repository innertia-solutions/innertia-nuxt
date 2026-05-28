<script setup>
import { ref, computed, watch, markRaw, nextTick } from 'vue'
import { VueFlow, Panel }                          from '@vue-flow/core'
import { Background }                              from '@vue-flow/background'
import { Controls }                                from '@vue-flow/controls'
import StepNode                                    from './nodes/StepNode.vue'
import TransitionEdge                              from './edges/TransitionEdge.vue'
import { definitionToFlow, flowToDefinition, autoLayoutWorkflow } from '~/composables/useWorkflowLayout.js'

// ── Props & emits ─────────────────────────────────────────────────────────────
const props = defineProps({
  modelValue: { type: Object, default: () => ({ steps: [], transitions: [] }) },
  readonly:   { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'node-click', 'edge-click', 'connect'])

// ── Vue Flow types ────────────────────────────────────────────────────────────
const nodeTypes = markRaw({ step: StepNode })
const edgeTypes = markRaw({ transition: TransitionEdge })

// ── Local nodes/edges refs (controlled) ──────────────────────────────────────
const flowNodes = ref([])
const flowEdges = ref([])

let _skipEmit = false

watch(
  () => props.modelValue,
  (def) => {
    _skipEmit = true
    const { nodes: n, edges: e } = definitionToFlow(def)
    flowNodes.value = n
    flowEdges.value = e
    nextTick(() => { _skipEmit = false })
  },
  { immediate: true, deep: true },
)

const emitDefinition = () => {
  if (props.readonly || _skipEmit) return
  emit('update:modelValue', flowToDefinition(flowNodes.value, flowEdges.value))
}

// ── View mode ─────────────────────────────────────────────────────────────────
const viewMode = ref('flow')

// ── Re-layout ─────────────────────────────────────────────────────────────────
const relayout = () => {
  const steps       = flowNodes.value.map(n => n.data)
  const transitions = flowEdges.value.map(e => ({ from: e.source, to: e.target }))
  const positions   = autoLayoutWorkflow(steps, transitions)
  flowNodes.value = flowNodes.value.map(n => ({
    ...n,
    position: positions[n.id] ?? n.position,
  }))
  // Forzar re-render del canvas con nueva key
  flowKey.value++
}

const flowKey = ref(0)

// ── Vue Flow events ───────────────────────────────────────────────────────────
const onNodesChange = (changes) => {
  // Vue Flow muta los nodes internamente; sólo emitimos tras posición/cambio
  nextTick(emitDefinition)
}

const onEdgesChange = () => {
  nextTick(emitDefinition)
}

const onConnect = (params) => {
  if (props.readonly) return
  flowEdges.value = [
    ...flowEdges.value,
    {
      id:        `${params.source}__${params.target}`,
      source:    params.source,
      target:    params.target,
      type:      'transition',
      label:     '',
      data:      { from: params.source, to: params.target, label: '', restrictions: [] },
      markerEnd: { type: 'arrowclosed' },
    },
  ]
  emit('connect', params)
  nextTick(emitDefinition)
}

// ── Config panel ──────────────────────────────────────────────────────────────
const selectedItem = ref(null)
const showPanel    = ref(false)

const onNodeClick = ({ node }) => {
  selectedItem.value = { type: 'step', id: node.id, data: { ...node.data } }
  showPanel.value    = true
  emit('node-click', node)
}

const onEdgeClick = ({ edge }) => {
  selectedItem.value = { type: 'transition', id: edge.id, data: { ...edge.data, label: edge.label ?? '' } }
  showPanel.value    = true
  emit('edge-click', edge)
}

const closePanel = () => { showPanel.value = false; selectedItem.value = null }

const savePanel = () => {
  if (!selectedItem.value || props.readonly) return
  if (selectedItem.value.type === 'step') {
    flowNodes.value = flowNodes.value.map(n =>
      n.id === selectedItem.value.id
        ? { ...n, id: selectedItem.value.data.key, data: { ...selectedItem.value.data } }
        : n
    )
    // Update edges if key changed
    if (selectedItem.value.id !== selectedItem.value.data.key) {
      const oldKey = selectedItem.value.id
      const newKey = selectedItem.value.data.key
      flowEdges.value = flowEdges.value.map(e => ({
        ...e,
        source: e.source === oldKey ? newKey : e.source,
        target: e.target === oldKey ? newKey : e.target,
        id:     e.id.replace(oldKey, newKey),
      }))
    }
  } else {
    flowEdges.value = flowEdges.value.map(e =>
      e.id === selectedItem.value.id
        ? { ...e, data: { ...selectedItem.value.data }, label: selectedItem.value.data.label ?? '' }
        : e
    )
  }
  emitDefinition()
  closePanel()
}

const deleteSelected = () => {
  if (!selectedItem.value || props.readonly) return
  if (selectedItem.value.type === 'step') {
    flowNodes.value = flowNodes.value.filter(n => n.id !== selectedItem.value.id)
    flowEdges.value = flowEdges.value.filter(e =>
      e.source !== selectedItem.value.id && e.target !== selectedItem.value.id
    )
  } else {
    flowEdges.value = flowEdges.value.filter(e => e.id !== selectedItem.value.id)
  }
  emitDefinition()
  closePanel()
}

// ── Add step ──────────────────────────────────────────────────────────────────
const STEP_TYPES  = ['start', 'in_progress', 'pause_internal', 'pause_external', 'finished', 'cancelled']
const STEP_LABELS = {
  start:          'Inicio',
  in_progress:    'En progreso',
  pause_internal: 'Pausa interna',
  pause_external: 'Pausa externa',
  finished:       'Finalizado',
  cancelled:      'Cancelado',
}

const showAddStep = ref(false)
const newStep     = ref({ key: '', label: '', type: 'in_progress', description: '' })

const addStep = () => {
  if (!newStep.value.key || !newStep.value.label) return
  const col = flowNodes.value.length
  flowNodes.value = [
    ...flowNodes.value,
    {
      id:       newStep.value.key,
      type:     'step',
      position: { x: col * 310, y: 0 },
      data:     { ...newStep.value },
    },
  ]
  emitDefinition()
  newStep.value     = { key: '', label: '', type: 'in_progress', description: '' }
  showAddStep.value = false
}

// ── Restrictions ──────────────────────────────────────────────────────────────
const RESTRICTION_TYPES = [
  { value: 'role',            label: 'Rol' },
  { value: 'required_fields', label: 'Campos requeridos' },
  { value: 'approval',        label: 'Aprobación' },
  { value: 'checklist',       label: 'Checklist' },
  { value: 'document',        label: 'Documento' },
  { value: 'min_items',       label: 'Mínimo ítems' },
  { value: 'date',            label: 'Fecha' },
  { value: 'custom',          label: 'Personalizado' },
]

const addRestriction = () => {
  if (!selectedItem.value?.data) return
  selectedItem.value.data.restrictions = [
    ...(selectedItem.value.data.restrictions ?? []),
    { type: 'role', roles: [], message: '' },
  ]
}

const removeRestriction = (idx) => {
  selectedItem.value.data.restrictions.splice(idx, 1)
}

// ── List view ─────────────────────────────────────────────────────────────────
const stepsWithTransitions = computed(() =>
  (props.modelValue.steps ?? []).map(step => ({
    ...step,
    outgoing: (props.modelValue.transitions ?? []).filter(t => t.from === step.key),
  }))
)
</script>

<template>
  <div class="flex flex-col h-full min-h-0">

    <!-- Toolbar -->
    <div class="flex items-center justify-between gap-3 px-3 py-2 border-b border-card-line bg-surface shrink-0">
      <div class="inline-flex items-center rounded-control border border-card-line bg-card overflow-hidden">
        <button
          v-for="mode in [{ id: 'flow', label: 'Flujo' }, { id: 'list', label: 'Lista' }]"
          :key="mode.id"
          type="button"
          @click="viewMode = mode.id"
          :class="[
            'px-3 py-1.5 text-xs font-medium transition-colors',
            viewMode === mode.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted-hover',
          ]"
        >
          {{ mode.label }}
        </button>
      </div>

      <div v-if="viewMode === 'flow'" class="flex items-center gap-2">
        <button
          type="button"
          @click="relayout"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-control transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
            <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clip-rule="evenodd" />
          </svg>
          Re-layout
        </button>
        <button
          v-if="!readonly"
          type="button"
          @click="showAddStep = true"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover rounded-control transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          Agregar step
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-1 min-h-0 relative overflow-hidden">

      <!-- ── FLOW VIEW ────────────────────────────────────────────────────── -->
      <div v-if="viewMode === 'flow'" class="flex-1 min-w-0 h-full">
        <VueFlow
          :key="flowKey"
          v-model:nodes="flowNodes"
          v-model:edges="flowEdges"
          :node-types="nodeTypes"
          :edge-types="edgeTypes"
          :nodes-draggable="!readonly"
          :nodes-connectable="!readonly"
          :elements-selectable="true"
          fit-view-on-init
          class="h-full bg-background"
          @nodes-change="onNodesChange"
          @edges-change="onEdgesChange"
          @connect="onConnect"
          @node-click="onNodeClick"
          @edge-click="onEdgeClick"
        >
          <Background pattern-color="var(--color-card-line)" :gap="20" />
          <Controls :show-interactive="!readonly" />
        </VueFlow>
      </div>

      <!-- ── LIST VIEW ─────────────────────────────────────────────────────── -->
      <div v-if="viewMode === 'list'" class="flex-1 overflow-y-auto p-4 space-y-3 h-full">
        <div
          v-for="step in stepsWithTransitions"
          :key="step.key"
          class="bg-card rounded-card border border-card-line overflow-hidden"
        >
          <div class="flex items-center gap-3 px-4 py-3 border-b border-card-line/50">
            <span :class="[
              'w-2 h-2 rounded-full shrink-0',
              { 'bg-emerald-500': step.type === 'start', 'bg-blue-500': step.type === 'in_progress',
                'bg-amber-500': step.type === 'pause_internal', 'bg-orange-500': step.type === 'pause_external',
                'bg-violet-500': step.type === 'finished', 'bg-red-500': step.type === 'cancelled' },
            ]" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-foreground truncate">{{ step.label }}</p>
              <p class="text-xs text-muted-foreground font-mono">{{ step.key }} · {{ STEP_LABELS[step.type] }}</p>
            </div>
            <span class="text-xs text-muted-foreground">
              {{ step.outgoing.length }} transición{{ step.outgoing.length !== 1 ? 'es' : '' }}
            </span>
          </div>
          <div v-if="step.outgoing.length" class="divide-y divide-card-line/50">
            <div v-for="t in step.outgoing" :key="t.to" class="flex items-center gap-3 px-4 py-2.5 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-muted-foreground-2 shrink-0">
                <path fill-rule="evenodd" d="M2 10a.75.75 0 0 1 .75-.75h12.59l-2.1-1.95a.75.75 0 1 1 1.02-1.1l3.5 3.25a.75.75 0 0 1 0 1.1l-3.5 3.25a.75.75 0 1 1-1.02-1.1l2.1-1.95H2.75A.75.75 0 0 1 2 10Z" clip-rule="evenodd" />
              </svg>
              <span class="flex-1 text-foreground">{{ t.label || t.to }}</span>
              <span v-if="t.restrictions?.length" class="text-xs px-1.5 py-0.5 rounded-badge bg-muted text-muted-foreground">
                {{ t.restrictions.length }} restricción{{ t.restrictions.length !== 1 ? 'es' : '' }}
              </span>
            </div>
          </div>
          <div v-else class="px-4 py-2.5 text-xs text-muted-foreground italic">Sin transiciones salientes</div>
        </div>
        <div v-if="!stepsWithTransitions.length" class="flex items-center justify-center py-16 text-muted-foreground text-sm">
          No hay steps definidos
        </div>
      </div>

      <!-- ── CONFIG PANEL ──────────────────────────────────────────────────── -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
      >
        <div
          v-if="showPanel && selectedItem"
          class="absolute right-0 top-0 bottom-0 w-80 bg-card border-l border-card-line shadow-xl z-10 flex flex-col overflow-hidden"
        >
          <div class="flex items-center justify-between px-4 py-3 border-b border-card-line shrink-0">
            <p class="text-sm font-medium text-foreground">
              {{ selectedItem.type === 'step' ? 'Configurar step' : 'Configurar transición' }}
            </p>
            <button type="button" @click="closePanel" class="p-1 text-muted-foreground hover:text-foreground transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <template v-if="selectedItem.type === 'step'">
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground">Clave (key)</label>
                <input v-model="selectedItem.data.key" :disabled="readonly" class="w-full h-8 px-2.5 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground">Label</label>
                <input v-model="selectedItem.data.label" :disabled="readonly" class="w-full h-8 px-2.5 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground">Tipo</label>
                <select v-model="selectedItem.data.type" :disabled="readonly" class="w-full h-8 px-2.5 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50">
                  <option v-for="t in STEP_TYPES" :key="t" :value="t">{{ STEP_LABELS[t] }} ({{ t }})</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground">Descripción</label>
                <textarea v-model="selectedItem.data.description" :disabled="readonly" rows="2" class="w-full px-2.5 py-1.5 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50 resize-none" />
              </div>
            </template>

            <template v-else-if="selectedItem.type === 'transition'">
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground">Label</label>
                <input v-model="selectedItem.data.label" :disabled="readonly" class="w-full h-8 px-2.5 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground">Descripción</label>
                <textarea v-model="selectedItem.data.description" :disabled="readonly" rows="2" class="w-full px-2.5 py-1.5 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50 resize-none" />
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-medium text-foreground">Restricciones</label>
                  <button v-if="!readonly" type="button" @click="addRestriction" class="text-xs text-primary hover:underline">+ Agregar</button>
                </div>
                <div v-for="(r, idx) in selectedItem.data.restrictions ?? []" :key="idx" class="rounded-control border border-card-line bg-surface p-2.5 space-y-2">
                  <div class="flex items-center gap-2">
                    <select v-model="r.type" :disabled="readonly" class="flex-1 h-7 px-2 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none disabled:opacity-50">
                      <option v-for="rt in RESTRICTION_TYPES" :key="rt.value" :value="rt.value">{{ rt.label }}</option>
                    </select>
                    <button v-if="!readonly" type="button" @click="removeRestriction(idx)" class="text-red-400 hover:text-red-600 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg>
                    </button>
                  </div>
                  <input v-model="r.message" :disabled="readonly" placeholder="Mensaje de error…" class="w-full h-7 px-2 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none disabled:opacity-50" />
                  <input v-if="r.type === 'role'"            v-model="r.roles"     :disabled="readonly" placeholder="admin, manager" class="w-full h-7 px-2 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none disabled:opacity-50" />
                  <input v-if="r.type === 'required_fields'" v-model="r.fields"    :disabled="readonly" placeholder="campo1, campo2" class="w-full h-7 px-2 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none disabled:opacity-50" />
                  <input v-if="r.type === 'checklist'"       v-model="r.checklist" :disabled="readonly" placeholder="nombre del checklist" class="w-full h-7 px-2 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none disabled:opacity-50" />
                  <input v-if="r.type === 'document'"        v-model="r.document"  :disabled="readonly" placeholder="nombre del documento" class="w-full h-7 px-2 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none disabled:opacity-50" />
                  <input v-if="r.type === 'approval'"        v-model="r.role"      :disabled="readonly" placeholder="rol que debe aprobar" class="w-full h-7 px-2 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none disabled:opacity-50" />
                </div>
                <p v-if="!selectedItem.data.restrictions?.length" class="text-xs text-muted-foreground italic">Sin restricciones</p>
              </div>
            </template>
          </div>

          <div class="flex items-center gap-2 px-4 py-3 border-t border-card-line shrink-0">
            <button v-if="!readonly" type="button" @click="deleteSelected" class="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-control transition-colors">Eliminar</button>
            <div class="flex-1" />
            <button type="button" @click="closePanel" class="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-control transition-colors">Cancelar</button>
            <button v-if="!readonly" type="button" @click="savePanel" class="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover rounded-control transition-colors">Guardar</button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Modal: Agregar step -->
    <Teleport to="body">
      <Transition enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="showAddStep" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="showAddStep = false">
          <div class="bg-card rounded-modal border border-card-line shadow-xl w-full max-w-sm p-5 space-y-4">
            <p class="text-sm font-semibold text-foreground">Nuevo step</p>
            <div class="space-y-3">
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground">Clave (key)</label>
                <input v-model="newStep.key" placeholder="ej. revision" class="w-full h-8 px-2.5 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground">Label</label>
                <input v-model="newStep.label" placeholder="ej. Revisión" class="w-full h-8 px-2.5 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground">Tipo</label>
                <select v-model="newStep.type" class="w-full h-8 px-2.5 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary">
                  <option v-for="t in STEP_TYPES" :key="t" :value="t">{{ STEP_LABELS[t] }} ({{ t }})</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" @click="showAddStep = false" class="px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded-control transition-colors">Cancelar</button>
              <button type="button" @click="addStep" :disabled="!newStep.key || !newStep.label" class="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary-hover rounded-control transition-colors disabled:opacity-50">Crear</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
