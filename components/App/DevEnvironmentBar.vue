<script setup>
const props = defineProps({ sidebar: { type: Boolean, default: false } })

const config = useRuntimeConfig()
const appEnv = config.public.appEnv

const isVisible = computed(() => appEnv && appEnv !== 'production')

useHead({
  htmlAttrs: { class: (!props.sidebar && isVisible.value) ? 'has-env-bar' : '' },
  style: [{ children: (!props.sidebar && isVisible.value) ? ':root { --env-bar-height: 1.5rem; }' : ':root { --env-bar-height: 0px; }' }],
})

const envColor = computed(() => {
  const env = appEnv.toLowerCase()
  if (env === 'staging') return props.sidebar ? 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30' : 'bg-amber-500 text-white'
  if (env === 'local' || env === 'dev') return props.sidebar ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30' : 'bg-blue-600 text-white'
  return props.sidebar ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30' : 'bg-red-600 text-white'
})
</script>

<template>
  <!-- Sidebar inline variant -->
  <div v-if="isVisible && sidebar"
    :class="['w-full rounded-lg px-3 py-1.5 flex items-center justify-center gap-x-1.5 select-none', envColor]"
  >
    <span class="text-[9px] font-black tracking-widest uppercase">ENTORNO: {{ appEnv }}</span>
  </div>

  <!-- Full-width fixed bar -->
  <div v-else-if="isVisible && !sidebar"
    class="fixed bottom-0 left-0 right-0 z-[100] h-6 overflow-hidden select-none pointer-events-none"
  >
    <div
      class="flex items-center justify-center w-full h-full text-[10px] font-bold tracking-widest uppercase opacity-90 shadow-lg border-t border-white/10"
      :class="envColor"
    >
      <span class="mr-2">━━━━━</span>
      ENTORNO: {{ appEnv }}
      <span class="ml-2">━━━━━</span>
    </div>
  </div>
</template>
