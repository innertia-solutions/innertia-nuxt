<script setup lang="ts">
definePageMeta({ layout: false })

const props = defineProps<{
  error: {
    statusCode: number
    statusMessage?: string
    message?: string
  }
}>()

const config = {
  404: {
    title: 'Página no encontrada',
    description: 'La página que buscas no existe o fue movida.',
    icon: '404',
  },
  403: {
    title: 'Acceso denegado',
    description: 'No tienes permisos para ver esta página.',
    icon: '403',
  },
  500: {
    title: 'Error del servidor',
    description: 'Algo salió mal. Intenta nuevamente en unos momentos.',
    icon: '500',
  },
} as const

type KnownCode = keyof typeof config

const current = computed(() => {
  const code = props.error.statusCode as KnownCode
  return config[code] ?? {
    title: 'Error inesperado',
    description: props.error.statusMessage || props.error.message || 'Ocurrió un error desconocido.',
    icon: String(props.error.statusCode),
  }
})

function goBack() {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    navigateTo('/')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
    <div class="max-w-md w-full text-center space-y-4">
      <div class="text-7xl font-bold text-slate-200 dark:text-slate-700 select-none">
        {{ current.icon }}
      </div>
      <h1 class="text-2xl font-semibold text-slate-800 dark:text-white">
        {{ current.title }}
      </h1>
      <p class="text-slate-500 dark:text-slate-400">
        {{ current.description }}
      </p>
      <div class="flex items-center justify-center gap-3 pt-2">
        <button
          class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          @click="goBack"
        >
          Volver
        </button>
        <NuxtLink
          to="/"
          class="px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-sm hover:bg-slate-700 dark:hover:bg-slate-600"
        >
          Ir al inicio
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
