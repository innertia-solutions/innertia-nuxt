<script setup>
/**
 * <ToastAlert> — Wrapper deprecated. Para uso nuevo: <ToastStandard>.
 * El store ahora maneja toast.severity normalizada (success|error|warning|info).
 */
const props = defineProps({ toast: { type: Object, required: true } })
const emit  = defineEmits(['close'])

// Map legacy severity 'danger' → 'error' para retrocompat.
const normalized = computed(() => ({
  ...props.toast,
  severity: props.toast.severity === 'danger' ? 'error' : props.toast.severity,
}))
</script>

<template>
  <ToastStandard :toast="normalized" @close="emit('close')" />
</template>
