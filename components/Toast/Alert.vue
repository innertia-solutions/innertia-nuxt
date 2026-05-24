<template>
  <div
    class="max-w-xs relative bg-card border border-card-line rounded-xl shadow-lg p-4 pr-10 flex items-start overflow-hidden"
    :class="{
      'border-green-200': toast.severity === 'success',
      'border-red-200': toast.severity === 'danger',
      'border-yellow-200': toast.severity === 'warning',
      'border-blue-200': toast.severity === 'info',
    }"
    role="alert"
  >
    <div class="mr-3 mt-1">
      <i v-if="toast.icon" :class="toast.icon + ' text-gray-400 text-xl'" />
    </div>
    <div class="flex-1 mt-1">
      <h3 v-if="toast.title" class="font-semibold text-sm text-gray-800">
        {{ toast.title }}
      </h3>
      <div class="text-sm dark:text-white text-gray-600" v-html="toast.message"></div>
    </div>
    <button
      class="ml-3 text-gray-400 hover:text-gray-700 absolute top-2 right-2"
      @click="$emit('close')"
    >
      <span class="sr-only">Cerrar</span>
      <svg
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
    
    <!-- Barra de progreso temporal -->
    <div 
      v-if="toast.duration && toast.duration > 0"
      class="absolute bottom-0 left-0 w-full h-1 bg-card-line"
    >
      <div
        class="h-full bg-gradient-to-r"
        :class="{
          'from-green-400 to-green-600': toast.severity === 'success',
          'from-red-400 to-red-600': toast.severity === 'danger',
          'from-yellow-400 to-yellow-600': toast.severity === 'warning',
          'from-blue-400 to-blue-600': toast.severity === 'info',
        }"
        :style="{ width: progressWidth + '%' }"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({ toast: Object });

const progressWidth = ref(100)
const startTime = ref(null)
let animationFrame = null

// Computed para detectar cambios en duration
const duration = computed(() => props.toast?.duration || 0)

// Función para actualizar el progreso
const updateProgress = () => {
  if (!startTime.value || duration.value <= 0) {
    progressWidth.value = 100
    return
  }

  const elapsed = Date.now() - startTime.value
  const remaining = Math.max(0, duration.value - elapsed)
  progressWidth.value = (remaining / duration.value) * 100

  if (remaining > 0) {
    animationFrame = requestAnimationFrame(updateProgress)
  }
}

// Watch para reiniciar cuando cambie el duration
watch(duration, (newDuration) => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
  
  if (newDuration && newDuration > 0) {
    startTime.value = Date.now()
    updateProgress()
  } else {
    progressWidth.value = 100
  }
}, { immediate: true })

onMounted(() => {
  if (duration.value > 0) {
    startTime.value = Date.now()
    updateProgress()
  }
})

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
})
</script>
