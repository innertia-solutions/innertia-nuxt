<script setup>
import {
  IconAlertTriangle, IconAlertCircle, IconInfoCircle, IconCircleCheck, IconHelp,
} from '@tabler/icons-vue'

/**
 * <ModalConfirm> — Diálogo de confirmación con severities.
 *
 * Severities: 'danger' | 'warning' | 'info' | 'success' | 'question' (default)
 * Emite 'confirm' (clic en CTA principal) y 'cancel' (clic cancelar / cerrar).
 *
 * Reemplaza <ModalDeleteConfirm> — mantenemos ese por backward-compat como
 * un wrapper que pasa severity="danger".
 */
const props = defineProps({
  modelValue:   { type: Boolean, default: false },
  severity:     { type: String,  default: 'question', validator: v => ['danger','warning','info','success','question'].includes(v) },
  title:        { type: String,  default: '' },
  message:      { type: String,  default: '' },
  confirmText:  { type: String,  default: 'Confirmar' },
  cancelText:   { type: String,  default: 'Cancelar' },
  loading:      { type: Boolean, default: false },
  /** Oculta el botón cancelar para alerts simples. */
  hideCancel:   { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const meta = computed(() => ({
  danger:   { icon: IconAlertTriangle, btn: 'danger',  bg: 'bg-red-500/10 text-red-600 dark:text-red-400',     title: props.title || 'Confirmar acción' },
  warning:  { icon: IconAlertCircle,   btn: 'warning', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', title: props.title || 'Atención' },
  info:     { icon: IconInfoCircle,    btn: 'primary', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',   title: props.title || 'Información' },
  success:  { icon: IconCircleCheck,   btn: 'primary', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', title: props.title || 'Confirmado' },
  question: { icon: IconHelp,          btn: 'primary', bg: 'bg-muted text-muted-foreground',                    title: props.title || '¿Continuar?' },
}[props.severity]))

const cancel = () => {
  if (props.loading) return
  emit('update:modelValue', false)
  emit('cancel')
}

const confirm = () => {
  if (props.loading) return
  emit('confirm')
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    size="sm"
    :show-header="false"
    :closable="!loading"
    :backdrop-dismiss="!loading"
    padding="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="flex items-start gap-4">
      <div :class="['size-10 rounded-control flex items-center justify-center shrink-0', meta.bg]">
        <component :is="meta.icon" class="size-5" :stroke="1.75" />
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-foreground">{{ meta.title }}</h3>
        <p v-if="message || $slots.default" class="text-sm text-muted-foreground mt-1">
          <slot>{{ message }}</slot>
        </p>
      </div>
    </div>

    <div class="flex justify-end gap-2 mt-5">
      <AppButton
        v-if="!hideCancel"
        :text="cancelText"
        severity="secondary"
        size="sm"
        :disabled="loading"
        @click="cancel"
      />
      <AppButton
        :text="confirmText"
        :severity="meta.btn"
        size="sm"
        :loading="loading"
        @click="confirm"
      />
    </div>
  </Modal>
</template>
