<template>
  <div
    class="flex flex-col items-center justify-center py-10 px-4 space-y-6 w-full h-full text-center"
  >
    <!-- Ícono/loader -->
    <svg
      class="animate-spin w-10 h-10 text-muted-foreground-2"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="10" opacity=".25" />
      <path d="M22 12a10 10 0 0 1-10 10" />
    </svg>

    <!-- Skeleton líneas -->
    <div class="w-full max-w-xs space-y-3">
      <div
        class="h-4 bg-surface-1 rounded animate-pulse"
      ></div>
      <div
        class="h-4 bg-surface-1 rounded animate-pulse"
      ></div>
      <div
        v-if="showHint"
        class="h-4 w-1/2 bg-surface-1 rounded animate-pulse mx-auto"
      ></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  showHint: { type: Boolean, default: false },
});
</script>
