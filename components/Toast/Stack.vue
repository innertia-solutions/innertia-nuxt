<script setup>
/**
 * <ToastStack /> — Mount-once en el layout root. Renderiza los toasts del
 * store en las 6 posiciones, con animación stack.
 */
import { useToastStore } from '../../stores/toast'

const store = useToastStore()

const POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

const positionClass = {
  'top-left':      'top-4 left-4',
  'top-center':    'top-4 left-1/2 -translate-x-1/2',
  'top-right':     'top-4 right-4',
  'bottom-left':   'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-right':  'bottom-4 right-4',
}

const isTop = (pos) => pos.startsWith('top-')
</script>

<template>
  <template v-for="pos in POSITIONS" :key="pos">
    <div
      v-if="store.toasts[pos]?.length"
      class="fixed z-[9998] flex flex-col gap-2 pointer-events-none"
      :class="positionClass[pos]"
    >
      <TransitionGroup :name="isTop(pos) ? 'toast-down' : 'toast-up'">
        <ToastStandard
          v-for="toast in store.toasts[pos]"
          :key="toast.id"
          :toast="toast"
          @close="store.dismiss(toast.id)"
        />
      </TransitionGroup>
    </div>
  </template>
</template>

<style scoped>
.toast-down-enter-active,
.toast-up-enter-active,
.toast-down-leave-active,
.toast-up-leave-active { transition: all 0.25s cubic-bezier(.2,.8,.2,1); }

.toast-down-enter-from { opacity: 0; transform: translateY(-12px) scale(0.97); }
.toast-up-enter-from   { opacity: 0; transform: translateY(12px) scale(0.97); }
.toast-down-leave-to,
.toast-up-leave-to     { opacity: 0; transform: scale(0.95); }

.toast-down-move,
.toast-up-move         { transition: transform 0.25s ease; }
</style>
