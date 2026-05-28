<script setup>
import { IconBolt, IconReload, IconLoader2 } from '@tabler/icons-vue'

/**
 * <InfoToolbar> — Reload + Instant badge en modo compacto.
 *
 * Usado por Table.Standard, Tree.Standard y Kanban.Standard cuando
 * `infoPosition === 'top'` (info se ubica en el toolbar superior en vez del footer).
 *
 * El badge "Instant" se reduce a un cuadrado verde con el ícono de rayo y un tooltip
 * de Preline (`hs-tooltip`) que explica el cache.
 */
defineProps({
  showReload:    { type: Boolean, default: true },
  isFetching:    { type: Boolean, default: false },
  showInstant:   { type: Boolean, default: false },
  reloadTitle:   { type: String,  default: 'Recargar' },
  instantTitle:  { type: String,  default: 'Datos en caché — recargá para sincronizar' },
})

const emit = defineEmits(['reload'])
</script>

<template>
  <div class="inline-flex items-center gap-1">
    <!-- Instant — cuadradito verde con tooltip, SIEMPRE a la izquierda -->
    <div v-if="showInstant" class="hs-tooltip [--placement:bottom] inline-block">
      <div
        class="hs-tooltip-toggle inline-flex items-center justify-center size-7 rounded-control bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-help"
      >
        <IconBolt class="size-3.5 fill-current" />
      </div>
      <span
        class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-50 py-1 px-2 bg-tooltip border border-tooltip-line text-xs font-medium text-tooltip-foreground rounded-popover shadow-2xs whitespace-nowrap"
        role="tooltip"
      >
        {{ instantTitle }}
      </span>
    </div>

    <!-- Reload -->
    <button
      v-if="showReload"
      type="button"
      :title="reloadTitle"
      :disabled="isFetching"
      class="p-1.5 inline-flex items-center justify-center rounded-control border border-transparent text-muted-foreground hover:border-card-line hover:bg-muted-hover hover:text-foreground transition-colors disabled:opacity-50"
      @click="emit('reload')"
    >
      <IconLoader2 v-if="isFetching" class="size-4 animate-spin" />
      <IconReload  v-else class="size-4" />
    </button>
  </div>
</template>
