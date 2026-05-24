<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const reason = computed(() => route.query.reason as string | undefined)

const messages = {
  'no-subdomain': {
    title: 'Acceso no válido',
    description: 'No se encontró un espacio de trabajo en esta dirección. Verifica que estés usando la URL correcta.',
  },
  'inactive': {
    title: 'Espacio de trabajo inactivo',
    description: 'Este espacio de trabajo ha sido desactivado. Contacta al administrador.',
  },
  'timeout': {
    title: 'Sin respuesta del servidor',
    description: 'El servidor tardó demasiado en responder. Intenta nuevamente en unos momentos.',
  },
  'unreachable': {
    title: 'Servicio no disponible',
    description: 'No se pudo conectar con el servidor. Verifica tu conexión e intenta nuevamente.',
  },
} as const

const fallback = { title: 'Error inesperado', description: 'Ocurrió un problema al cargar tu espacio de trabajo.' }
const current = computed(() => messages[reason.value as keyof typeof messages] ?? fallback)
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
    <div class="max-w-md w-full text-center space-y-4">
      <div class="text-6xl font-bold text-slate-300 dark:text-slate-700 select-none">
        :(
      </div>
      <h1 class="text-2xl font-semibold text-slate-800 dark:text-white">
        {{ current.title }}
      </h1>
      <p class="text-slate-500 dark:text-slate-400">
        {{ current.description }}
      </p>
      <button
        class="mt-4 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
        @click="$router.go(0)"
      >
        Reintentar
      </button>
    </div>
  </div>
</template>
