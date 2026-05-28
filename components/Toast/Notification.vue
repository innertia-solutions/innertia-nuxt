<script setup>
/** Deprecated. Para uso nuevo: <ToastStandard variant="notification">. */
const props = defineProps({ toast: { type: Object, required: true } })
const emit  = defineEmits(['close'])
const normalized = computed(() => ({ ...props.toast, variant: 'notification' }))
</script>

<template>
  <ToastStandard :toast="normalized" @close="emit('close')" />
</template>
