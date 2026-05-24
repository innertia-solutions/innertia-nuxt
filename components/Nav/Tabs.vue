<script setup lang="ts">
import { useRoute } from 'vue-router'

interface Tab {
  label: string
  to: string
  icon?: any
  exact?: boolean
}

const props = withDefaults(defineProps<{
  tabs: Tab[]
  color?: string
  activeClass?: string
}>(), {
  color: 'blue',
})

const colorTextClass = computed(() => ({
  blue:   'text-blue-600   dark:text-blue-400',
  gray:   'text-foreground',
  slate:  'text-foreground',
  green:  'text-green-600  dark:text-green-400',
  amber:  'text-amber-600  dark:text-amber-400',
  red:    'text-red-600    dark:text-red-400',
  purple: 'text-purple-600 dark:text-purple-400',
  rose:   'text-rose-600   dark:text-rose-400',
}[props.color] ?? 'text-blue-600 dark:text-blue-400'))

const resolvedActiveClass = computed(() =>
  props.activeClass ?? `bg-card shadow-sm ${colorTextClass.value}`
)

const route = useRoute()

const isActive = (tab: Tab) =>
  tab.exact ? route.path === tab.to : route.path.startsWith(tab.to)
</script>

<template>
  <div class="flex items-center gap-x-1 p-1 bg-surface border border-card-line rounded-xl w-fit">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="flex items-center gap-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-all"
      :class="isActive(tab)
        ? resolvedActiveClass
        : 'text-muted-foreground hover:text-foreground'"
    >
      <component :is="tab.icon" v-if="tab.icon" class="size-4" />
      {{ tab.label }}
    </NuxtLink>
  </div>
</template>
