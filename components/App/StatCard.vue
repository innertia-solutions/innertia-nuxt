<script setup>
/*
 * StatCard — indicador/KPI para la fila de resumen entre el título y la tabla.
 * Estilo alineado a finance/index.vue (bg-card + rounded-card + tokens).
 */
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  hint: { type: String, default: '' },
  valueClass: { type: String, default: 'text-foreground' },
  icon: { type: [Object, Function], default: null },
  iconClass: { type: String, default: 'bg-primary/10 text-primary' },
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <div class="bg-card border border-card-line rounded-card p-5 flex items-start justify-between gap-3">
    <div class="min-w-0">
      <p class="text-xs uppercase tracking-wider text-muted-foreground">{{ label }}</p>
      <p v-if="loading" class="mt-2 h-7 w-16 bg-surface-1 rounded animate-pulse" />
      <p v-else class="mt-2 text-2xl font-semibold" :class="valueClass">{{ value }}</p>
      <span v-if="hint && !loading" class="text-xs text-muted-foreground">{{ hint }}</span>
    </div>
    <div v-if="icon" class="size-10 shrink-0 rounded-lg flex items-center justify-center" :class="iconClass">
      <component :is="icon" class="size-5" :stroke-width="1.8" />
    </div>
  </div>
</template>
