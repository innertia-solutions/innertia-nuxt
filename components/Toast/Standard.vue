<script setup>
import {
  IconCircleCheck, IconAlertCircle, IconAlertTriangle, IconInfoCircle, IconX,
} from '@tabler/icons-vue'

/**
 * <ToastStandard> — Renderizador unificado de toasts.
 *
 * Variants: 'alert' (default) | 'notification' | 'process'
 * Severities: success | error | warning | info
 *
 * El auto-dismiss se visualiza como un anillo circular alrededor del botón de
 * cerrar (usando <Loader>).
 */
const props = defineProps({
  toast: { type: Object, required: true },
})

const emit = defineEmits(['close'])

const meta = computed(() => ({
  success: { icon: IconCircleCheck,    accent: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-l-emerald-500', loader: 'emerald' },
  error:   { icon: IconAlertCircle,    accent: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/10',     border: 'border-l-red-500',     loader: 'red' },
  warning: { icon: IconAlertTriangle,  accent: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   border: 'border-l-amber-500',   loader: 'amber' },
  info:    { icon: IconInfoCircle,     accent: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10',    border: 'border-l-blue-500',    loader: 'blue' },
}[props.toast.severity] ?? {
  icon: IconInfoCircle, accent: 'text-muted-foreground', bg: 'bg-muted', border: 'border-l-muted-foreground', loader: 'muted',
}))

const isNotification = computed(() => props.toast.variant === 'notification')
const isProcess      = computed(() => props.toast.variant === 'process')
const hasCountdown   = computed(() => !isProcess.value && props.toast.duration && props.toast.duration > 0)

const onAction = () => {
  try { props.toast.action?.onClick?.() } finally {
    if (props.toast.action?.dismissOnClick !== false) emit('close')
  }
}
</script>

<template>
  <div
    role="alert"
    :class="[
      'pointer-events-auto relative w-[22rem] max-w-[90vw] bg-card border border-card-line border-l-4 rounded-card shadow-lg overflow-hidden',
      'flex gap-3',
      isProcess ? 'items-start' : 'items-center',
      isNotification ? 'p-4 pr-12' : 'p-3 pr-11',
      meta.border,
    ]"
  >
    <!-- Icon -->
    <div :class="['shrink-0 size-8 rounded-control flex items-center justify-center', meta.bg, meta.accent]">
      <component :is="meta.icon" class="size-4" :stroke="1.75" />
    </div>

    <!-- Contenido -->
    <div class="flex-1 min-w-0">
      <p v-if="toast.title" class="text-sm font-semibold text-foreground truncate">{{ toast.title }}</p>
      <div
        v-if="toast.message"
        :class="['text-foreground leading-relaxed', toast.title ? 'text-xs text-muted-foreground mt-0.5' : 'text-sm']"
        v-html="toast.message"
      />

      <!-- Process progress (variant 'process') -->
      <div v-if="isProcess" class="mt-2">
        <Loader
          shape="bar"
          :value="toast.progress ?? 0"
          :stroke="4"
          :color="meta.loader"
        />
        <div class="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground font-mono">
          <span>{{ toast.progressLabel || '' }}</span>
          <span>{{ Math.round(toast.progress ?? 0) }}%</span>
        </div>
      </div>

      <!-- Action -->
      <button
        v-if="toast.action?.label"
        type="button"
        class="mt-2 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
        @click="onAction"
      >
        {{ toast.action.label }}
      </button>
    </div>

    <!-- Close + countdown ring -->
    <button
      v-if="toast.closable !== false"
      type="button"
      class="absolute top-1/2 -translate-y-1/2 right-2 size-8 inline-flex items-center justify-center rounded-full text-foreground hover:text-foreground transition-colors group"
      aria-label="Cerrar"
      @click="emit('close')"
    >
      <Loader
        v-if="hasCountdown"
        shape="circle"
        mode="countdown"
        direction="empty"
        :duration="toast.duration"
        :size="32"
        :stroke="7"
        :color="meta.loader"
        track="auto"
        class="!absolute inset-0 pointer-events-none"
        @complete="emit('close')"
      />
      <IconX class="size-4 relative z-10 text-foreground group-hover:scale-110 transition-transform" :stroke="2.25" />
    </button>
  </div>
</template>
