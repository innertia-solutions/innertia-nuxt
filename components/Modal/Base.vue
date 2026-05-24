<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title:      { type: String,  default: '' },
  size:       { type: String,  default: 'md' },
  loading:    { type: Boolean, default: false },
  closable:   { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'close'])
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="title"
    :size="size"
    :closable="closable && !loading"
    :backdrop-dismiss="closable && !loading"
    :show-footer="!!$slots.footer"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
  >
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </Modal>
</template>
