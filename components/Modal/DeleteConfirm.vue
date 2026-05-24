<script setup>
const props = defineProps({
  modelValue:  { type: Boolean, default: false },
  title:       { type: String, default: 'Confirmar eliminación' },
  message:     { type: String, default: 'Esta acción es irreversible. ¿Estás seguro de que deseas continuar?' },
  confirmText: { type: String, default: 'Eliminar' },
  cancelText:  { type: String, default: 'Cancelar' },
  loading:     { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const close = () => {
  if (props.loading) return
  emit('update:modelValue', false)
  emit('cancel')
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="title"
    size="sm"
    :closable="!loading"
    :backdrop-dismiss="!loading"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <p class="text-sm text-muted-foreground">{{ message }}</p>

    <div class="flex justify-end gap-2 mt-5">
      <AppButton
        :text="cancelText"
        severity="secondary"
        size="sm"
        :disabled="loading"
        @click="close"
      />
      <AppButton
        :text="confirmText"
        severity="danger"
        size="sm"
        :loading="loading"
        @click="$emit('confirm')"
      />
    </div>
  </Modal>
</template>
