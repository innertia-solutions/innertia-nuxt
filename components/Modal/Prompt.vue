<script setup>
/**
 * <ModalPrompt> — Diálogo para capturar un string del usuario.
 *
 * Usado principalmente por useModal().prompt(). Emite 'submit' con el valor
 * y 'cancel' al cerrar.
 */
const props = defineProps({
  modelValue:   { type: Boolean, default: false },
  title:        { type: String,  default: 'Ingresar valor' },
  message:      { type: String,  default: '' },
  placeholder:  { type: String,  default: '' },
  defaultValue: { type: String,  default: '' },
  confirmText:  { type: String,  default: 'Aceptar' },
  cancelText:   { type: String,  default: 'Cancelar' },
  required:     { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'submit', 'cancel'])

const value = ref(props.defaultValue)
const inputRef = ref(null)

watch(() => props.modelValue, async (v) => {
  if (v) {
    value.value = props.defaultValue
    await nextTick()
    inputRef.value?.focus()
  }
})

const cancel = () => {
  emit('update:modelValue', false)
  emit('cancel')
}

const submit = () => {
  if (props.required && !value.value.trim()) return
  emit('submit', value.value)
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="title"
    size="sm"
    :show-footer="true"
    padding="md"
    @update:model-value="emit('update:modelValue', $event)"
    @close="cancel"
  >
    <p v-if="message" class="text-sm text-muted-foreground mb-3">{{ message }}</p>
    <input
      ref="inputRef"
      v-model="value"
      type="text"
      :placeholder="placeholder"
      class="innertia-field w-full"
      @keydown.enter="submit"
    />

    <template #footer>
      <AppButton :text="cancelText" severity="secondary" size="sm" @click="cancel" />
      <AppButton
        :text="confirmText"
        severity="primary"
        size="sm"
        :disabled="required && !value.trim()"
        @click="submit"
      />
    </template>
  </Modal>
</template>
