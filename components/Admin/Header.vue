<script setup lang="ts">
defineProps<{
  title?: string
}>()

const sidebar = inject('spark:sidebar', null) as any
</script>

<template>
  <header class="sticky top-0 z-40 bg-card border-b border-card-line px-4 lg:px-6 h-14 flex items-center gap-x-3">
    <!-- Hamburger mobile -->
    <button type="button"
      class="lg:hidden size-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
      @click="sidebar?.open()">
      <svg class="size-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>

    <!-- Left slot -->
    <div class="flex-1 flex items-center gap-x-3">
      <slot name="left">
        <span v-if="title" class="text-sm font-medium text-foreground">{{ title }}</span>
      </slot>
    </div>

    <!-- Right slot -->
    <div class="flex items-center gap-x-2">
      <slot name="right" />
    </div>
  </header>
</template>
