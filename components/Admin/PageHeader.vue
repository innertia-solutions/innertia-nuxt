<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="sticky top-0 z-20 -mx-3 -mt-3 px-3 pt-3 bg-background-1">
  <div class="flex items-center justify-between bg-card border border-card-line rounded-2xl shadow-sm px-4 py-3">
    <div class="flex items-center gap-x-4">
      <slot name="icon" />
      <div>
        <div class="flex items-baseline gap-x-2">
          <h1 class="text-lg font-semibold text-foreground">{{ title }}</h1>
          <template v-if="description">
            <span class="size-1 rounded-full bg-surface-1 shrink-0 self-center"></span>
            <p class="text-sm text-muted-foreground">{{ description }}</p>
          </template>
        </div>
        <div v-if="$slots.breadcrumb" class="flex items-center gap-x-1 mt-0.5">
          <slot name="breadcrumb" />
        </div>
      </div>
    </div>
    <div class="flex items-center gap-x-2">
      <slot name="actions" />
    </div>
  </div>
  </div>
</template>
