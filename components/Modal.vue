<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title:      { type: String, default: '' },
  size:       { type: String, default: 'md', validator: v => ['xs','sm','md','lg','xl','2xl','3xl','fullscreen'].includes(v) },
  closable:   { type: Boolean, default: true },
  backdropDismiss: { type: Boolean, default: true },
  showHeader: { type: Boolean, default: true },
  showFooter: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'close'])

const modalId = `modal-${Math.random().toString(36).slice(2, 9)}`

const sizeClass = computed(() => ({
  xs: 'max-w-xs', sm: 'max-w-sm', md: 'max-w-md',
  lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl', fullscreen: 'max-w-full',
}[props.size] ?? 'max-w-md'))

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}

const onBackdrop = (e) => {
  if (e.target === e.currentTarget && props.backdropDismiss && props.closable) close()
}

const onEsc = (e) => { if (e.key === 'Escape' && props.modelValue && props.closable) close() }

watch(() => props.modelValue, v => {
  document.body.style.overflow = v ? 'hidden' : ''
})

onMounted(() => document.addEventListener('keydown', onEsc))
onUnmounted(() => {
  document.removeEventListener('keydown', onEsc)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport v-if="modelValue" to="body">
    <Transition name="modal" appear>
      <div
        class="fixed inset-0 z-[9999] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        role="dialog"
        tabindex="-1"
        :aria-labelledby="`${modalId}-label`"
        @click="onBackdrop"
      >
        <div
          :class="['bg-card border border-card-line rounded-xl shadow-xl w-full modal-content', sizeClass]"
          @click.stop
        >
          <!-- Header -->
          <div v-if="showHeader" class="flex items-center justify-between px-5 py-4 border-b border-card-line">
            <h3 :id="`${modalId}-label`" class="text-sm font-semibold text-foreground">
              <slot name="header">{{ title }}</slot>
            </h3>
            <button
              v-if="closable"
              type="button"
              class="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-muted-foreground-1 hover:bg-muted-hover transition-colors"
              @click="close"
            >
              <svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-5">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="showFooter" class="flex items-center justify-end gap-2 px-5 py-4 border-t border-card-line">
            <slot name="footer">
              <AppButton v-if="closable" text="Cerrar" severity="secondary" size="sm" @click="close" />
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from,
.modal-leave-to      { opacity: 0; }

.modal-enter-from .modal-content,
.modal-leave-to .modal-content  { transform: scale(0.97) translateY(-8px); opacity: 0; }
.modal-enter-to .modal-content,
.modal-leave-from .modal-content { transform: scale(1) translateY(0); opacity: 1; }
.modal-content { transition: transform 0.15s ease, opacity 0.15s ease; }
</style>
