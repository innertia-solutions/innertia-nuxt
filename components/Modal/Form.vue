<script setup>
/**
 * <ModalForm> — Modal especializado para formularios largos.
 *
 * - Body scroll con header + footer sticky.
 * - Footer con submit (severity configurable) y cancelar.
 * - Soporta variant: 'center' | 'drawer-right' | 'drawer-left' | 'fullscreen'.
 * - Emite 'submit' al click del CTA principal y 'cancel' al cerrar/cancelar.
 *
 * El consumidor envuelve sus campos en el slot default — el componente NO
 * monta un <form> nativo para no interferir con la lógica del consumidor.
 * Si querés el comportamiento submit-on-enter, envolvé el contenido en <form>.
 */
const props = defineProps({
  modelValue:   { type: Boolean, default: false },
  title:        { type: String,  default: '' },
  size:         { type: String,  default: 'lg' },
  variant:      { type: String,  default: 'center' },
  submitText:   { type: String,  default: 'Guardar' },
  cancelText:   { type: String,  default: 'Cancelar' },
  submitSeverity: { type: String, default: 'primary' },
  loading:      { type: Boolean, default: false },
  /** Deshabilita el submit (validación). */
  disabled:     { type: Boolean, default: false },
  closable:     { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'submit', 'cancel'])

const cancel = () => {
  if (props.loading) return
  emit('update:modelValue', false)
  emit('cancel')
}

const submit = () => {
  if (props.loading || props.disabled) return
  emit('submit')
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="title"
    :size="size"
    :variant="variant"
    :closable="closable && !loading"
    :backdrop-dismiss="closable && !loading"
    :show-footer="true"
    padding="md"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('cancel')"
  >
    <slot />
    <template #footer>
      <slot name="footer">
        <AppButton
          :text="cancelText"
          severity="secondary"
          size="sm"
          :disabled="loading"
          @click="cancel"
        />
        <AppButton
          :text="submitText"
          :severity="submitSeverity"
          size="sm"
          :loading="loading"
          :disabled="disabled"
          @click="submit"
        />
      </slot>
    </template>
  </Modal>
</template>
