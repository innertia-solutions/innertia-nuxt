<script setup>
import { computed }         from 'vue'
import { Handle, Position } from '@vue-flow/core'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  data:     { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const STEP_CONFIG = {
  start:          { label: 'Inicio',      color: 'emerald',  dot: 'bg-emerald-500',    border: 'border-emerald-400 dark:border-emerald-600',    bg: 'bg-emerald-50 dark:bg-emerald-900/30'  },
  in_progress:    { label: 'En progreso', color: 'blue',     dot: 'bg-blue-500',       border: 'border-blue-400 dark:border-blue-600',          bg: 'bg-blue-50 dark:bg-blue-900/30'        },
  pause_internal: { label: 'Pausa int.',  color: 'amber',    dot: 'bg-amber-500',      border: 'border-amber-400 dark:border-amber-600',        bg: 'bg-amber-50 dark:bg-amber-900/30'      },
  pause_external: { label: 'Pausa ext.',  color: 'orange',   dot: 'bg-orange-500',     border: 'border-orange-400 dark:border-orange-600',      bg: 'bg-orange-50 dark:bg-orange-900/30'    },
  finished:       { label: 'Finalizado',  color: 'violet',   dot: 'bg-violet-500',     border: 'border-violet-400 dark:border-violet-600',      bg: 'bg-violet-50 dark:bg-violet-900/30'    },
  cancelled:      { label: 'Cancelado',   color: 'red',      dot: 'bg-red-500',        border: 'border-red-400 dark:border-red-600',            bg: 'bg-red-50 dark:bg-red-900/30'          },
}

const cfg = computed(() => STEP_CONFIG[props.data.type] ?? STEP_CONFIG.in_progress)
const isStart    = computed(() => props.data.type === 'start')
const isTerminal = computed(() => ['finished', 'cancelled'].includes(props.data.type))
</script>

<template>
  <div
    :class="[
      'relative flex flex-col gap-1 rounded-lg border-2 px-3 py-2.5 w-52 bg-card shadow-sm transition-shadow',
      cfg.border,
      selected ? 'shadow-md ring-2 ring-primary/50 ring-offset-1' : 'hover:shadow-md',
    ]"
  >
    <!-- Handles invisibles en Top — para rutear back-edges por encima del nodo -->
    <Handle
      id="top-target"
      type="target"
      :position="Position.Top"
      style="opacity:0; pointer-events:none; width:6px; height:6px;"
    />
    <Handle
      id="top-source"
      type="source"
      :position="Position.Top"
      style="opacity:0; pointer-events:none; width:6px; height:6px;"
    />

    <!-- Target handle (no mostrar para nodo start) -->
    <Handle
      v-if="!isStart"
      type="target"
      :position="Position.Left"
      class="!bg-card-line !border-card-line !w-3 !h-3 hover:!bg-primary transition-colors"
    />

    <!-- Header: dot + type badge -->
    <div class="flex items-center gap-2">
      <span :class="['w-2 h-2 rounded-full shrink-0', cfg.dot]" />
      <span
        :class="[
          'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full',
          cfg.bg, 'text-foreground',
        ]"
      >
        {{ cfg.label }}
      </span>
    </div>

    <!-- Label -->
    <p class="text-sm font-medium text-foreground leading-tight truncate">{{ data.label }}</p>

    <!-- Key -->
    <p class="text-[11px] text-muted-foreground font-mono truncate">{{ data.key }}</p>

    <!-- Description (if present) -->
    <p v-if="data.description" class="text-[11px] text-muted-foreground leading-tight line-clamp-2 mt-0.5">
      {{ data.description }}
    </p>

    <!-- Source handle (no mostrar para terminales) -->
    <Handle
      v-if="!isTerminal"
      type="source"
      :position="Position.Right"
      class="!bg-card-line !border-card-line !w-3 !h-3 hover:!bg-primary transition-colors"
    />
  </div>
</template>
