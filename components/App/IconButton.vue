<script setup>
/**
 * <App.IconButton> — botón de solo ícono (acciones de fila, toolbars).
 * Uso:
 *   <App.IconButton :icon="IconPencil" label="Editar" to="/ruta" />
 *   <App.IconButton :icon="IconTrash" label="Eliminar" variant="danger" @click="..." />
 */
const props = defineProps({
  icon: { type: [Object, Function], required: true },
  label: { type: String, default: '' }, // title + aria-label
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md'].includes(v) },
  variant: { type: String, default: 'default', validator: (v) => ['default', 'danger', 'primary'].includes(v) },
  to: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const boxSize = computed(() => (props.size === 'sm' ? 'size-7' : 'size-8'))
const iconSize = computed(() => (props.size === 'sm' ? 'size-3.5' : 'size-4'))
const variantClass = computed(() => ({
  default: 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800',
  danger:  'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10',
  primary: 'text-slate-400 hover:text-primary hover:bg-primary/10',
}[props.variant] || ''))
</script>

<template>
  <NuxtLink
    v-if="to" :to="to" :title="label || undefined" :aria-label="label || undefined"
    class="inline-flex items-center justify-center rounded-lg transition-colors"
    :class="[boxSize, variantClass]"
  >
    <component :is="icon" :class="iconSize" :stroke-width="1.5" />
  </NuxtLink>
  <button
    v-else type="button" :disabled="disabled" :title="label || undefined" :aria-label="label || undefined"
    class="inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    :class="[boxSize, variantClass]"
  >
    <component :is="icon" :class="iconSize" :stroke-width="1.5" />
  </button>
</template>
