<script setup>
/** Deprecated. Para uso nuevo: <ToastStandard variant="process">. */
const props = defineProps({ toast: { type: Object, required: true } })
const emit  = defineEmits(['close'])
const normalized = computed(() => ({ ...props.toast, variant: 'process' }))
</script>

<template>
  <ToastStandard :toast="normalized" @close="emit('close')" />
</template>
