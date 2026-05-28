<script setup>
/**
 * <FilesUploadModal> — `<FilesUpload>` wrappeado en `<Modal>`.
 *
 * Uso:
 *   <FilesUploadModal
 *     v-model:open="showUpload"
 *     endpoint="backoffice/invoices/123/files"
 *     title="Adjuntar comprobante"
 *     :max-size-mb="10"
 *     accept=".pdf"
 *     @uploaded="(file) => attach(file)"
 *   />
 */
const props = defineProps({
  /** Endpoint multipart (idem FilesUpload). */
  endpoint:      { type: String, required: true },

  /** Título del modal. */
  title:         { type: String, default: 'Subir archivo' },

  /** Tamaño del modal. */
  size:          { type: String, default: 'lg' },

  // Pass-through a FilesUpload
  field:         { type: String, default: 'file' },
  multiple:      { type: Boolean, default: false },
  accept:        { type: String, default: '' },
  maxSizeMb:     { type: Number, default: 0 },
  maxFiles:      { type: Number, default: 0 },
  autoUpload:    { type: Boolean, default: true },
  extraData:     { type: Object, default: () => ({}) },
  hint:          { type: String, default: 'Arrastrá archivos o hacé click para seleccionar' },
  hintSecondary: { type: String, default: '' },

  /** Cerrar el modal automáticamente cuando todos los uploads terminan exitosos. */
  closeOnComplete: { type: Boolean, default: true },
})

const open = defineModel('open', { default: false })

const emit = defineEmits(['uploaded', 'error', 'complete'])

const uploadRef = ref(null)

const handleComplete = (results) => {
  emit('complete', results)
  if (props.closeOnComplete && results.failed.length === 0 && results.success.length > 0) {
    // Pequeño delay para que el usuario vea los checkmarks verdes antes de cerrar
    setTimeout(() => { open.value = false }, 600)
  }
}

watch(open, (v) => {
  if (!v) uploadRef.value?.clearAll()
})
</script>

<template>
  <Modal
    v-model="open"
    :title="title"
    :size="size"
    :backdrop-dismiss="false"
  >
    <FilesUpload
      ref="uploadRef"
      :endpoint="endpoint"
      :field="field"
      :multiple="multiple"
      :accept="accept"
      :max-size-mb="maxSizeMb"
      :max-files="maxFiles"
      :auto-upload="autoUpload"
      :extra-data="extraData"
      :hint="hint"
      :hint-secondary="hintSecondary"
      @uploaded="(file, item) => emit('uploaded', file, item)"
      @error="(err) => emit('error', err)"
      @complete="handleComplete"
    />
  </Modal>
</template>
