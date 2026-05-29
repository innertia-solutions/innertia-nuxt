<script setup>
import { ref, computed, markRaw, watch } from 'vue'
import { VueFlow, Panel }                from '@vue-flow/core'
import { Background }                    from '@vue-flow/background'
import { Controls }                      from '@vue-flow/controls'
import StepNode                          from './nodes/StepNode.vue'
import TransitionEdge                    from './edges/TransitionEdge.vue'
import { definitionToFlow }              from '~/composables/useWorkflowLayout'

// ── Props & emits ─────────────────────────────────────────────────────────────
const props = defineProps({
  /** WorkflowDefinition.config — { steps:[], transitions:[] } */
  definition:           { type: Object, required: true },
  /** current_step key */
  currentStep:          { type: String, default: null },
  /** array de step keys disponibles para transicionar */
  availableTransitions: { type: Array, default: () => [] },
  /** array de { from_step, to_step, performed_by, performed_at, notes } */
  history:              { type: Array, default: () => [] },
  /** 'flow' | 'list' | 'history' */
  defaultView:          { type: String, default: 'flow' },
})

const emit = defineEmits(['transition'])

// ── Vue Flow types ────────────────────────────────────────────────────────────
const nodeTypes = markRaw({ step: StepNode })
const edgeTypes = markRaw({ transition: TransitionEdge })

// ── Reactive nodes/edges — re-calculados cuando cambia currentStep o definition
const flowNodes = ref([])
const flowEdges = ref([])

const rebuildFlow = () => {
  const { nodes: n, edges: e } = definitionToFlow(props.definition)

  flowNodes.value = n.map(node => ({
    ...node,
    selectable: false,
    draggable:  false,
    class: [
      node.id === props.currentStep             ? 'vf-current'   : '',
      props.availableTransitions.includes(node.id) ? 'vf-available' : '',
    ].filter(Boolean).join(' '),
    data: {
      ...node.data,
      isCurrent:   node.id === props.currentStep,
      isAvailable: props.availableTransitions.includes(node.id),
    },
  }))

  flowEdges.value = e
}

watch(
  [() => props.definition, () => props.currentStep, () => props.availableTransitions],
  rebuildFlow,
  { immediate: true, deep: true },
)

// ── View mode ─────────────────────────────────────────────────────────────────
const activeView = ref(props.defaultView)

// ── List helpers ──────────────────────────────────────────────────────────────
const STEP_TYPE_LABELS = {
  start:          'Inicio',
  in_progress:    'En progreso',
  pause_internal: 'Pausa interna',
  pause_external: 'Pausa externa',
  finished:       'Finalizado',
  cancelled:      'Cancelado',
}

const stepsWithState = computed(() =>
  (props.definition.steps ?? []).map(step => ({
    ...step,
    isCurrent:   step.key === props.currentStep,
    isAvailable: props.availableTransitions.includes(step.key),
    isPast:      (props.history ?? []).some(h => h.to_step === step.key),
  }))
)

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'
</script>

<template>
  <div class="flex flex-col h-full min-h-0">

    <!-- Toolbar -->
    <div class="flex items-center justify-between gap-3 px-3 py-2 border-b border-card-line bg-surface shrink-0">
      <div class="inline-flex items-center rounded-control border border-card-line bg-card overflow-hidden">
        <button
          v-for="mode in [{ id: 'flow', label: 'Flujo' }, { id: 'list', label: 'Lista' }, { id: 'history', label: 'Historial' }]"
          :key="mode.id"
          type="button"
          @click="activeView = mode.id"
          :class="[
            'px-3 py-1.5 text-xs font-medium transition-colors',
            activeView === mode.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted-hover',
          ]"
        >
          {{ mode.label }}
        </button>
      </div>

      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full border-2 border-primary bg-primary/20" />
          Actual
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" />
          Disponible
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 min-h-0 relative overflow-hidden">

      <!-- ── FLOW VIEW ──────────────────────────────────────────────────────── -->
      <div v-if="activeView === 'flow'" class="h-full">
        <VueFlow
          :nodes="flowNodes"
          :edges="flowEdges"
          :node-types="nodeTypes"
          :edge-types="edgeTypes"
          :nodes-draggable="false"
          :nodes-connectable="false"
          :elements-selectable="false"
          fit-view-on-init
          class="h-full bg-background"
        >
          <Background pattern-color="var(--color-card-line)" :gap="20" />
          <Controls :show-interactive="false" />

          <Panel position="bottom-center">
            <div v-if="availableTransitions.length" class="flex items-center gap-2 flex-wrap justify-center pb-2">
              <button
                v-for="stepKey in availableTransitions"
                :key="stepKey"
                type="button"
                @click="emit('transition', stepKey)"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover rounded-control shadow transition-colors"
              >
                Ir a {{ definition.steps?.find(s => s.key === stepKey)?.label ?? stepKey }}
              </button>
            </div>
          </Panel>
        </VueFlow>
      </div>

      <!-- ── LIST VIEW ──────────────────────────────────────────────────────── -->
      <div v-if="activeView === 'list'" class="h-full overflow-y-auto p-4">
        <div class="relative pl-6 space-y-1 before:absolute before:left-[7px] before:top-3 before:bottom-3 before:w-px before:bg-card-line">
          <div
            v-for="step in stepsWithState"
            :key="step.key"
            :class="[
              'relative flex items-start gap-3 pl-4 py-3 rounded-card transition-colors',
              step.isCurrent   ? 'bg-primary/5 border border-primary/20' : '',
              step.isAvailable && !step.isCurrent ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-400/30' : '',
              !step.isCurrent && !step.isAvailable ? 'opacity-60' : '',
            ]"
          >
            <span
              :class="[
                'absolute -left-[3px] top-4 w-3 h-3 rounded-full border-2 shrink-0',
                step.isCurrent   ? 'border-primary bg-primary' : '',
                step.isAvailable && !step.isCurrent ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/50' : '',
                !step.isCurrent && !step.isAvailable ? 'border-card-line bg-background' : '',
              ]"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-foreground">{{ step.label }}</p>
              <p class="text-xs text-muted-foreground font-mono">{{ step.key }} · {{ STEP_TYPE_LABELS[step.type] }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="step.isCurrent" class="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-badge bg-primary/10 text-primary">
                Actual
              </span>
              <button
                v-if="step.isAvailable && !step.isCurrent"
                type="button"
                @click="emit('transition', step.key)"
                class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                Transicionar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── HISTORY ────────────────────────────────────────────────────────── -->
      <div v-if="activeView === 'history'" class="h-full overflow-y-auto p-4">
        <div v-if="history.length" class="space-y-2">
          <div
            v-for="(entry, idx) in [...history].reverse()"
            :key="idx"
            class="flex items-start gap-3 bg-card rounded-card border border-card-line px-4 py-3"
          >
            <div class="w-2 h-2 rounded-full bg-primary/60 shrink-0 mt-1.5" />
            <div class="flex-1 min-w-0">
              <p class="text-xs text-foreground">
                <span class="font-mono text-muted-foreground">{{ entry.from_step }}</span>
                <span class="mx-1.5 text-muted-foreground-2">→</span>
                <span class="font-mono font-medium">{{ entry.to_step }}</span>
              </p>
              <p v-if="entry.notes" class="text-xs text-muted-foreground mt-0.5 italic">{{ entry.notes }}</p>
            </div>
            <p class="text-[11px] text-muted-foreground shrink-0">{{ formatDate(entry.performed_at) }}</p>
          </div>
        </div>
        <div v-else class="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Sin historial de transiciones
        </div>
      </div>

    </div>
  </div>
</template>
