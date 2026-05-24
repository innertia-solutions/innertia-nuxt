<script setup>
import { IconX } from '@tabler/icons-vue'

const { docked, undock, expandDock, activeDockId } = useDockedPreviews()
const router = useRouter()
const route  = useRoute()

async function open(item, event) {
  // Misma ruta → la tabla está montada, mostrar float encima del tab
  if (route.path === item.route) {
    const rect = event.currentTarget.getBoundingClientRect()
    expandDock(item.id, rect)
    return
  }
  // Ruta diferente → navegar y restaurar como preview completo
  await router.push(item.route)
  await nextTick()
  useNuxtApp().hooks.callHook('preview:restore', item)
}
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0 translate-y-4"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-4"
  >
    <div
      v-if="docked.length"
      class="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-2 px-4 py-2 bg-card/95 backdrop-blur-md border-t border-card-line shadow-lg"
    >
      <span class="text-xs text-muted-foreground shrink-0 mr-1">Minimizados</span>

      <div class="flex items-center gap-2 flex-1 overflow-x-auto">
        <button
          v-for="item in docked"
          :key="item.id"
          type="button"
          class="group inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all shrink-0"
          :class="activeDockId === item.id
            ? 'border-primary/50 bg-primary/10 text-primary shadow-sm'
            : 'border-card-line bg-surface hover:bg-muted-hover text-foreground'"
          @click="open(item, $event)"
        >
          <span class="size-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
            {{ (item.label?.[0] ?? '?').toUpperCase() }}
          </span>
          <span class="font-medium max-w-32 truncate">{{ item.label }}</span>
          <span v-if="item.subtitle" class="text-muted-foreground text-xs max-w-28 truncate hidden sm:inline">{{ item.subtitle }}</span>

          <span
            class="size-4 inline-flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-0.5"
            @click.stop="undock(item.id)"
          >
            <IconX class="size-3" />
          </span>
        </button>
      </div>
    </div>
  </Transition>
</template>
