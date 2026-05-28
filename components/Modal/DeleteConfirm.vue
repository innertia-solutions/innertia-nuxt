<script setup>
/**
 * <ModalDeleteConfirm> — Wrapper deprecated sobre <ModalConfirm> con severity="danger".
 * Para uso nuevo: usar <ModalConfirm severity="danger"> directamente.
 */
const props = defineProps({
  modelValue:  { type: Boolean, default: false },
  title:       { type: String, default: 'Confirmar eliminación' },
  message:     { type: String, default: 'Esta acción es irreversible. ¿Estás seguro de que deseas continuar?' },
  confirmText: { type: String, default: 'Eliminar' },
  cancelText:  { type: String, default: 'Cancelar' },
  loading:     { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])
</script>

<template>
  <ModalConfirm
    :model-value="modelValue"
    severity="danger"
    :title="title"
    :message="message"
    :confirm-text="confirmText"
    :cancel-text="cancelText"
    :loading="loading"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  />
</template>
