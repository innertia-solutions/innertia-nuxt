<script setup>
import { computed }                                   from 'vue'
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from '@vue-flow/core'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  id:              String,
  sourceX:         Number,
  sourceY:         Number,
  targetX:         Number,
  targetY:         Number,
  sourcePosition:  String,
  targetPosition:  String,
  data:            { type: Object, default: () => ({}) },
  label:           { type: String, default: '' },
  selected:        { type: Boolean, default: false },
  markerEnd:       String,
})

// ── Path reactivo — recalculado cuando cambian las posiciones ─────────────────
const pathData = computed(() =>
  getBezierPath({
    sourceX:        props.sourceX,
    sourceY:        props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX:        props.targetX,
    targetY:        props.targetY,
    targetPosition: props.targetPosition,
  })
)

const edgePath = computed(() => pathData.value[0])
const labelX   = computed(() => pathData.value[1])
const labelY   = computed(() => pathData.value[2])

const hasRestrictions = computed(() => (props.data?.restrictions?.length ?? 0) > 0)
const displayLabel    = computed(() => props.label || props.data?.label || '')
const isBackEdge      = computed(() => props.data?.isBackEdge === true)
</script>

<template>
  <BaseEdge
    :id="id"
    :path="edgePath"
    :marker-end="markerEnd"
    :style="{
      stroke:           selected ? 'var(--color-primary)' : isBackEdge ? 'var(--color-muted-foreground)' : 'var(--color-card-line)',
      strokeWidth:      selected ? 2 : 1.5,
      strokeDasharray:  isBackEdge ? '5 3' : 'none',
      opacity:          isBackEdge && !selected ? 0.65 : 1,
    }"
  />

  <EdgeLabelRenderer v-if="displayLabel || hasRestrictions">
    <div
      :style="{
        transform:     `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
        pointerEvents: 'all',
      }"
      class="absolute nodrag nopan"
    >
      <div
        :class="[
          'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
          selected
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card text-foreground border-card-line hover:border-primary/50',
        ]"
      >
        <span v-if="displayLabel">{{ displayLabel }}</span>
        <span
          v-if="hasRestrictions"
          :class="[
            'inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold',
            selected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
          ]"
        >
          {{ data.restrictions.length }}
        </span>
      </div>
    </div>
  </EdgeLabelRenderer>
</template>
