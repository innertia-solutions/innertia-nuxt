<script setup>
/**
 * <Container> — Card / panel reutilizable que sigue los tokens del DS.
 *
 * Usado para contenido estático: settings, dashboards, KPI tiles, info boxes,
 * formularios agrupados. NO para Tree/Table/Kanban (esos manejan su propio
 * layout interno complejo).
 *
 * Slots:
 *   - default — body
 *   - header  — reemplaza el header entero (si necesitás algo custom)
 *   - actions — botones a la derecha del título
 *   - footer  — pie con border-top
 *
 * Props:
 *   - title / subtitle — texto del header automático
 *   - bordered         — true = border + rounded-card (default)
 *   - padding          — 'none' | 'sm' | 'md' (default) | 'lg' del body
 *   - size             — 'sm' | 'md' | 'lg' | 'fit' (default) — min-height baseline
 *   - tone             — 'default' | 'muted' | 'primary' | 'destructive' | 'emerald' | 'amber'
 */

const props = defineProps({
  title:    { type: String, default: '' },
  subtitle: { type: String, default: '' },
  bordered: { type: Boolean, default: true },
  padding:  { type: String,  default: 'md' },
  size:     { type: String,  default: 'fit' },
  tone:     { type: String,  default: 'default' },
})

const slots = useSlots()

const hasAutoHeader = computed(() => !!(props.title || props.subtitle || slots.actions))
const hasHeaderSlot = computed(() => !!slots.header)
const showHeader    = computed(() => hasHeaderSlot.value || hasAutoHeader.value)

// ─── Padding del body ────────────────────────────────────────────────────────
const paddingClass = computed(() => ({
  none: '',
  sm:   'p-3',
  md:   'p-5',
  lg:   'p-7',
}[props.padding] ?? 'p-5'))

// ─── Size (min-height baseline) ──────────────────────────────────────────────
const sizeStyle = computed(() => {
  switch (props.size) {
    case 'sm':  return { minHeight: '8rem' }
    case 'md':  return { minHeight: '14rem' }
    case 'lg':  return { minHeight: '24rem' }
    case 'fit':
    default:    return {}
  }
})

// ─── Tone (color del border + bg sutil) ──────────────────────────────────────
const toneClasses = computed(() => {
  if (!props.bordered) return 'bg-card'
  switch (props.tone) {
    case 'muted':       return 'bg-muted/30 border-card-line'
    case 'primary':     return 'bg-primary/5 border-primary/20'
    case 'destructive': return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50'
    case 'emerald':     return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50'
    case 'amber':       return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
    case 'default':
    default:            return 'bg-card border-card-line'
  }
})
</script>

<template>
  <div
    :class="[
      'flex flex-col',
      toneClasses,
      bordered ? 'border rounded-card overflow-hidden' : '',
    ]"
    :style="sizeStyle"
  >
    <!-- Header -->
    <div
      v-if="showHeader"
      :class="[
        'shrink-0 flex items-center gap-3 px-5 py-4',
        bordered ? 'border-b border-card-line' : '',
      ]"
    >
      <slot name="header">
        <div class="flex-1 min-w-0">
          <h3 v-if="title" class="text-sm font-semibold text-foreground truncate">{{ title }}</h3>
          <p v-if="subtitle" class="text-xs text-muted-foreground mt-0.5 truncate">{{ subtitle }}</p>
        </div>
        <div v-if="$slots.actions" class="shrink-0 flex items-center gap-1">
          <slot name="actions" />
        </div>
      </slot>
    </div>

    <!-- Body -->
    <div :class="['flex-1 min-h-0', paddingClass]">
      <slot />
    </div>

    <!-- Footer -->
    <div
      v-if="$slots.footer"
      :class="[
        'shrink-0 px-5 py-3',
        bordered ? 'border-t border-card-line' : '',
      ]"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
