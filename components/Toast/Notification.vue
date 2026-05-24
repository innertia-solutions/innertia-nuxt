<template>
  <div
    class="max-w-xs bg-white border border-gray-200 rounded-xl shadow-lg p-4 flex"
    role="alert"
  >
    <div class="shrink-0">
      <svg
        class="size-5 text-gray-600 mt-1"
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    </div>
    <div class="ms-4">
      <h3 v-if="toast.title" class="text-gray-800 font-semibold">
        {{ toast.title }}
      </h3>
      <div class="mt-1 text-sm text-gray-600" v-html="toast.message"></div>
      <div v-if="toast.actions" class="mt-4">
        <div class="flex gap-x-3">
          <button
            v-for="(action, i) in toast.actions"
            :key="i"
            @click="action.onClick"
            class="text-blue-600 decoration-2 hover:underline font-medium text-sm focus:outline-hidden focus:underline"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
defineProps({ toast: Object });
</script>
