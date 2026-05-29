<script setup lang="ts">
import * as TablerIcons from '@tabler/icons-vue'
import { IconArrowRight } from '@tabler/icons-vue'
import type { ContextDefinition } from '~/configs/apps'

const props = defineProps<{
  /** Contexts a mostrar como opciones de login. */
  options: ContextDefinition[]
  /** Título personalizable. */
  title?: string
}>()

const emit = defineEmits<{
  /** Emitido cuando el usuario elige un context — el padre se encarga de navegar y recordar la elección. */
  pick: [context: ContextDefinition]
}>()

const heading = computed(() => props.title ?? '¿Cómo quieres ingresar?')

function resolveIcon(name?: string) {
  if (!name) return null
  return (TablerIcons as Record<string, unknown>)[name] ?? null
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-slate-950">
    <!-- Header con logo -->
    <div class="flex items-center justify-center px-6 pt-10 pb-8">
      <img :src="'/isologo-light.png'" alt="Asetio" class="h-8 dark:hidden" />
      <img :src="'/isologo-dark.png'" alt="Asetio" class="h-8 hidden dark:block" />
    </div>

    <!-- Body -->
    <div class="flex-1 flex items-start justify-center px-6">
      <div class="w-full max-w-sm space-y-6">
        <div class="text-center space-y-1.5">
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
            {{ heading }}
          </h1>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            Elige el tipo de acceso para continuar.
          </p>
        </div>

        <!-- Opciones -->
        <div class="space-y-3">
          <button
            v-for="context in options"
            :key="context.path"
            type="button"
            class="group w-full flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 text-left hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-colors"
            @click="emit('pick', context)"
          >
            <div class="shrink-0 size-11 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center group-hover:bg-violet-200 dark:group-hover:bg-violet-900/50 transition-colors">
              <component
                v-if="resolveIcon(context.icon)"
                :is="resolveIcon(context.icon)"
                class="size-5 text-violet-600 dark:text-violet-400"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-base font-semibold text-slate-900 dark:text-white">
                {{ context.label }}
              </div>
              <div v-if="context.description" class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                {{ context.description }}
              </div>
            </div>
            <IconArrowRight class="shrink-0 size-5 text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
          </button>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-6 py-6 text-center">
      <p class="text-xs text-slate-400 dark:text-slate-600">
        © {{ new Date().getFullYear() }} {{ $config.public.appName ?? 'Asetio' }}
      </p>
    </div>
  </div>
</template>
