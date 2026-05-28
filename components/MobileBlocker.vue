<script setup lang="ts">
import { IconDeviceDesktop, IconArrowRight, IconCopy, IconCheck } from '@tabler/icons-vue'
import type { ContextDefinition } from '~/configs/apps'

const props = defineProps<{
  /** Context al que se intentó acceder (para el copy contextual). */
  blockedApp?: ContextDefinition | null
  /** Context mobile-friendly al que el usuario puede continuar (opcional). */
  fallbackApp?: ContextDefinition | null
}>()

const route = useRoute()
const currentUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return window.location.origin + route.fullPath
})

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(currentUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    /* clipboard puede fallar en algunos contextos — silent */
  }
}

const blockedAppLabel = computed(() => props.blockedApp?.label ?? 'esta sección')
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 px-6 py-10">
    <div class="w-full max-w-sm text-center space-y-6">
      <!-- Icono -->
      <div class="mx-auto size-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
        <IconDeviceDesktop class="size-8 text-violet-600 dark:text-violet-400" />
      </div>

      <!-- Mensaje -->
      <div class="space-y-2">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
          Mejor en pantalla grande
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {{ blockedAppLabel }} está optimizada para uso en escritorio o tablet. Para una mejor experiencia, abre este enlace en un computador.
        </p>
      </div>

      <!-- Fallback: continuar en app mobile -->
      <div v-if="fallbackApp" class="pt-2">
        <NuxtLink
          :to="fallbackApp.home"
          class="flex items-center justify-between gap-3 w-full rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-4 py-3 text-left hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
        >
          <div>
            <div class="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Continuar como
            </div>
            <div class="text-sm font-semibold text-slate-900 dark:text-white">
              {{ fallbackApp.label }}
            </div>
          </div>
          <IconArrowRight class="size-5 text-violet-600 dark:text-violet-400 shrink-0" />
        </NuxtLink>
      </div>

      <!-- Copiar enlace para mandarse al pc -->
      <button
        type="button"
        @click="copyLink"
        class="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <IconCheck v-if="copied" class="size-4 text-emerald-600" />
        <IconCopy v-else class="size-4" />
        <span>{{ copied ? 'Enlace copiado' : 'Copiar enlace para abrir en pc' }}</span>
      </button>

      <!-- Footer -->
      <p class="text-xs text-slate-400 dark:text-slate-600 pt-4">
        © {{ new Date().getFullYear() }} {{ $config.public.appName ?? 'Asetio' }}
      </p>
    </div>
  </div>
</template>
