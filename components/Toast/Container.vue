<script setup>
const toastStore = useToastStore()

const positions = [
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
</script>

<template>
  <template v-for="pos in positions" :key="pos">
    <div
      v-if="toastStore.toasts[pos]?.length"
      class="fixed z-50 flex flex-col gap-2"
      :class="positionClass[pos]"
    >
      <ToastAlert
        v-for="toast in toastStore.toasts[pos]"
        :key="toast.id"
        :toast="toast"
        @close="toastStore.remove(toast.id)"
      />
    </div>
  </template>
</template>
