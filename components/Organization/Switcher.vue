<script setup lang="ts">
/**
 * Dropdown para cambiar entre organizaciones desde dentro de un contexto.
 *
 * - Oculto si el feature está desactivado o el user solo tiene 1 org.
 * - Muestra org actual + lista de accesibles.
 * - Si `allowConsolidated`, agrega toggle "Vista consolidada" al final.
 *
 * Pensado para insertar en el topbar del layout backoffice (slot `topbar-actions`).
 */
import { IconBuildingSkyscraper, IconCheck, IconChevronDown, IconLayoutGrid } from '@tabler/icons-vue'

const {
  isEnabled,
  allowConsolidated,
  available,
  current,
  consolidated,
  switchTo,
} = useOrganization()

const visible = computed(() => isEnabled.value && available.value.length > 1)
</script>

<template>
  <div v-if="visible" class="hs-dropdown [--placement:bottom-right] relative inline-flex">
    <button
      type="button"
      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-foreground-inverse hover:bg-plain/10 focus:outline-hidden text-sm"
      aria-haspopup="menu"
    >
      <IconBuildingSkyscraper class="size-4 shrink-0" />
      <span class="hidden md:inline truncate max-w-32">{{ current?.name ?? 'Sin organización' }}</span>
      <IconChevronDown class="size-3.5 shrink-0 opacity-60" />
    </button>

    <div
      class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-64 transition-[opacity,margin] opacity-0 hidden z-20 bg-dropdown border border-dropdown-line rounded-xl shadow-xl"
      role="menu"
    >
      <div class="p-1 border-b border-dropdown-divider">
        <div class="py-2 px-3">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Organización</p>
        </div>
        <button
          v-for="org in available"
          :key="org.key"
          type="button"
          @click="switchTo(org.key)"
          class="w-full flex items-center gap-x-2.5 py-2 px-3 rounded-lg text-sm text-dropdown-item-foreground hover:bg-dropdown-item-hover focus:outline-hidden"
        >
          <div class="size-7 rounded-md bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
            <IconBuildingSkyscraper class="size-3.5 text-primary dark:text-primary-300" />
          </div>
          <div class="flex-1 min-w-0 text-left">
            <div class="text-sm font-medium truncate">{{ org.name }}</div>
            <div class="text-[10px] text-muted-foreground truncate">{{ org.key }}</div>
          </div>
          <IconCheck v-if="current?.key === org.key" class="size-4 text-primary shrink-0" />
        </button>
      </div>

      <div v-if="allowConsolidated" class="p-1">
        <button
          type="button"
          @click="consolidated = !consolidated"
          class="w-full flex items-center gap-x-2.5 py-2 px-3 rounded-lg text-sm text-dropdown-item-foreground hover:bg-dropdown-item-hover focus:outline-hidden"
        >
          <IconLayoutGrid class="size-4 shrink-0 text-muted-foreground" />
          <span class="flex-1 text-left">Vista consolidada</span>
          <span
            class="inline-flex items-center h-4 w-7 rounded-full transition-colors"
            :class="consolidated ? 'bg-primary' : 'bg-muted'"
          >
            <span
              class="inline-block size-3 bg-white rounded-full transition-transform"
              :class="consolidated ? 'translate-x-3.5' : 'translate-x-0.5'"
            />
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
