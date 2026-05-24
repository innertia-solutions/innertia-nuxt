<template>
  <div
    class="max-w-xs relative bg-white border border-gray-200 rounded-xl shadow-lg"
    role="alert"
  >
    <div class="flex gap-x-3 p-4">
      <div class="shrink-0">
        <span
          class="m-1 inline-flex justify-center items-center size-8 rounded-full bg-gray-100 text-gray-800"
        >
          <svg
            class="shrink-0 size-4"
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
            <path
              d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"
            />
            <path d="M12 12v9" />
            <path d="m16 16-4-4-4 4" />
          </svg>
        </span>
        <button
          class="absolute top-3 end-3 inline-flex shrink-0 justify-center items-center size-5 rounded-lg text-gray-800 opacity-50 hover:opacity-100 focus:outline-hidden focus:opacity-100"
          @click="$emit('close')"
          aria-label="Close"
        >
          <span class="sr-only">Close</span>
          <svg
            class="shrink-0 size-4"
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
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <div class="grow me-5">
        <h3 v-if="toast.title" class="text-gray-800 font-medium text-sm">
          {{ toast.title }}
        </h3>
        <div
          v-if="toast.progress !== undefined"
          class="mt-2 flex flex-col gap-x-3"
        >
          <span class="block mb-1.5 text-xs text-gray-500">{{
            toast.progressLabel
          }}</span>
          <div
            class="flex w-full h-1 bg-gray-200 rounded-full overflow-hidden"
            role="progressbar"
            :aria-valuenow="toast.progress"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="flex flex-col justify-center overflow-hidden bg-blue-600 text-xs text-white text-center whitespace-nowrap"
              :style="{ width: toast.progress + '%' }"
            ></div>
          </div>
        </div>
        <div
          v-else
          class="mt-2 text-sm text-gray-600"
          v-html="toast.message"
        ></div>
      </div>
    </div>
  </div>
</template>
<script setup>
defineProps({ toast: Object });
</script>
