<script setup>
import { IconX } from '@tabler/icons-vue'

/**
 * <Modal> — Core modal. Sigue tokens semánticos (rounded-modal, bg-card,
 * border-card-line). Variantes: center (default), drawer-right, drawer-left,
 * fullscreen. Tamaños xs..3xl.
 *
 * No tiene lógica de negocio. Para casos típicos preferir:
 *   - <ModalConfirm>  → confirmaciones con severities
 *   - <ModalForm>     → modal con form, scroll y footer sticky
 *   - useModal()      → API promise-based (alert/confirm/prompt/open)
 */
const props = defineProps({
  modelValue:      { type: Boolean, default: false },
  title:           { type: String,  default: '' },
  size:            { type: String,  default: 'md', validator: v => ['xs','sm','md','lg','xl','2xl','3xl','fullscreen'].includes(v) },
  variant:         { type: String,  default: 'center', validator: v => ['center','drawer-right','drawer-left','fullscreen'].includes(v) },
  closable:        { type: Boolean, default: true },
  backdropDismiss: { type: Boolean, default: true },
  showHeader:      { type: Boolean, default: true },
  showFooter:      { type: Boolean, default: false },
  /** Hace el body scrollable con el header/footer sticky. */
  scrollBody:      { type: Boolean, default: true },
  /** Padding del body. 'none' para que el slot controle su propio padding. */
  padding:         { type: String,  default: 'md', validator: v => ['none','sm','md','lg'].includes(v) },
})

const emit = defineEmits(['update:modelValue', 'close'])

const modalId = `modal-${Math.random().toString(36).slice(2, 9)}`

const isDrawer = computed(() => props.variant.startsWith('drawer'))
const isFullscreen = computed(() => props.variant === 'fullscreen' || props.size === 'fullscreen')

const sizeClass = computed(() => {
  if (isFullscreen.value) return 'max-w-full w-full h-full'
  return ({
    xs: 'max-w-xs', sm: 'max-w-sm', md: 'max-w-md',
    lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl', '3xl': 'max-w-3xl',
  }[props.size] ?? 'max-w-md')
})

const paddingClass = computed(() => ({
  none: 'p-0', sm: 'p-3', md: 'p-5', lg: 'p-6',
}[props.padding] ?? 'p-5'))

const containerClass = computed(() => {
  if (isFullscreen.value) return 'inset-0'
  if (props.variant === 'drawer-right') return 'inset-y-0 right-0'
  if (props.variant === 'drawer-left')  return 'inset-y-0 left-0'
  return 'inset-0 items-center justify-center p-4'
})

const panelClass = computed(() => {
  if (isFullscreen.value) return 'w-full h-full rounded-none'
  if (isDrawer.value)     return `h-full ${sizeClass.value} rounded-none`
  return `w-full ${sizeClass.value} rounded-modal`
})

const transitionName = computed(() => {
  if (isFullscreen.value)             return 'modal-fade'
  if (props.variant === 'drawer-right') return 'modal-slide-right'
  if (props.variant === 'drawer-left')  return 'modal-slide-left'
  return 'modal-pop'
})

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}

const onBackdrop = (e) => {
  if (e.target === e.currentTarget && props.backdropDismiss && props.closable) close()
}

const onEsc = (e) => { if (e.key === 'Escape' && props.modelValue && props.closable) close() }

watch(() => props.modelValue, v => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = v ? 'hidden' : ''
  }
})

onMounted(() => document.addEventListener('keydown', onEsc))
onUnmounted(() => {
  document.removeEventListener('keydown', onEsc)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<template>
  <Teleport v-if="modelValue" to="body">
    <Transition :name="transitionName" appear>
      <div
        class="fixed z-[9999] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex"
        :class="containerClass"
        role="dialog"
        tabindex="-1"
        :aria-labelledby="`${modalId}-label`"
        @click="onBackdrop"
      >
        <div
          :class="['bg-card border border-card-line shadow-xl flex flex-col overflow-hidden modal-panel max-h-full', panelClass]"
          @click.stop
        >
          <!-- Header -->
          <div
            v-if="showHeader"
            class="shrink-0 flex items-center justify-between px-5 py-4 border-b border-card-line"
          >
            <h3 :id="`${modalId}-label`" class="text-sm font-semibold text-foreground truncate">
              <slot name="header">{{ title }}</slot>
            </h3>
            <button
              v-if="closable"
              type="button"
              class="size-7 flex items-center justify-center rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors shrink-0"
              @click="close"
              aria-label="Cerrar"
            >
              <IconX class="size-4" />
            </button>
          </div>

          <!-- Body -->
          <div
            :class="[
              paddingClass,
              scrollBody ? 'flex-1 min-h-0 overflow-y-auto' : '',
            ]"
          >
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="showFooter"
            class="shrink-0 flex items-center justify-end gap-2 px-5 py-4 border-t border-card-line bg-card"
          >
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
/* Center pop */
.modal-pop-enter-active,
.modal-pop-leave-active { transition: opacity 0.15s ease; }
.modal-pop-enter-from,
.modal-pop-leave-to     { opacity: 0; }
.modal-pop-enter-from .modal-panel,
.modal-pop-leave-to .modal-panel    { transform: scale(0.97) translateY(-8px); opacity: 0; }
.modal-pop-enter-to .modal-panel,
.modal-pop-leave-from .modal-panel  { transform: scale(1) translateY(0); opacity: 1; }
.modal-panel { transition: transform 0.18s cubic-bezier(.2,.8,.2,1), opacity 0.18s ease; }

/* Fade fullscreen */
.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to     { opacity: 0; }

/* Drawer right */
.modal-slide-right-enter-active,
.modal-slide-right-leave-active { transition: opacity 0.2s ease; }
.modal-slide-right-enter-from,
.modal-slide-right-leave-to     { opacity: 0; }
.modal-slide-right-enter-from .modal-panel,
.modal-slide-right-leave-to .modal-panel   { transform: translateX(100%); }
.modal-slide-right-enter-to .modal-panel,
.modal-slide-right-leave-from .modal-panel { transform: translateX(0); }

/* Drawer left */
.modal-slide-left-enter-active,
.modal-slide-left-leave-active { transition: opacity 0.2s ease; }
.modal-slide-left-enter-from,
.modal-slide-left-leave-to     { opacity: 0; }
.modal-slide-left-enter-from .modal-panel,
.modal-slide-left-leave-to .modal-panel    { transform: translateX(-100%); }
.modal-slide-left-enter-to .modal-panel,
.modal-slide-left-leave-from .modal-panel  { transform: translateX(0); }
</style>
