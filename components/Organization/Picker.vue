<script setup lang="ts">
/**
 * Overlay full-screen para elegir organización al entrar a un contexto sin
 * tener una guardada (o cuando la guardada ya no es accesible).
 *
 * Se renderiza desde los layouts (auth, backoffice) cuando `useOrganization().needsPicker`
 * devuelve `true`. Bloquea el contenido detrás hasta que el user elija.
 *
 * Persistencia: al elegir, se guarda en cookie 30d (via store).
 */
import { IconBuildingSkyscraper, IconArrowRight } from '@tabler/icons-vue'

const { current: currentApp } = useApp()
const { available, switchTo } = useOrganization()

const title = computed(() =>
  currentApp.value
    ? `Elige una organización para continuar en ${currentApp.value.label}`
    : 'Elige una organización'
)

async function pick(slug: string) {
  await switchTo(slug)
}
</script>

<template>
  <div class="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-md space-y-6">
      <div class="text-center space-y-2">
        <div class="mx-auto size-12 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <IconBuildingSkyscraper class="size-6 text-primary dark:text-primary-300" />
        </div>
        <h1 class="text-xl font-bold text-foreground">{{ title }}</h1>
        <p class="text-sm text-muted-foreground">
          Selecciona la organización con la que quieres trabajar. Podrás cambiarla más adelante.
        </p>
      </div>

      <div class="space-y-2">
        <button
          v-for="org in available"
          :key="org.key"
          type="button"
          @click="pick(org.key)"
          class="group w-full flex items-center gap-3 rounded-xl border border-card-line bg-card px-4 py-3.5 text-left hover:border-primary/40 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors"
        >
          <div class="size-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
            <IconBuildingSkyscraper class="size-5 text-primary dark:text-primary-300" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-foreground truncate">{{ org.name }}</div>
            <div class="text-xs text-muted-foreground truncate">{{ org.key }}</div>
          </div>
          <IconArrowRight class="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </button>
      </div>
    </div>
  </div>
</template>
