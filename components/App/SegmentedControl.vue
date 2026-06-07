<script setup>
/**
 * <App.SegmentedControl> — control segmentado / toggle horizontal.
 * Uso:
 *   <App.SegmentedControl v-model="view" :options="[{value:'kanban',icon:IconLayoutKanban},{value:'table',icon:IconTable}]" />
 *   <App.SegmentedControl v-model="tab" :options="[{value:'a',label:'Regular'},{value:'b',label:'PIE'}]" />
 */
const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: null },
  options: { type: Array, required: true }, // [{ value, label?, icon? }]
  size: { type: String, default: 'sm', validator: (v) => ['sm', 'md'].includes(v) },
})
const emit = defineEmits(['update:modelValue'])

const pad = computed(() => (props.size === 'md' ? 'px-3.5 py-2 text-sm' : 'px-3 py-1.5 text-sm'))
const iconSize = computed(() => (props.size === 'md' ? 'size-4' : 'size-4'))
</script>

<template>
  <div class="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
    <button
      v-for="o in options" :key="String(o.value)" type="button"
      @click="emit('update:modelValue', o.value)"
      :title="o.label || undefined"
      class="inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors"
      :class="[pad, modelValue === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground']"
    >
      <component :is="o.icon" v-if="o.icon" :class="iconSize" :stroke-width="1.5" />
      <span v-if="o.label">{{ o.label }}</span>
    </button>
  </div>
</template>
