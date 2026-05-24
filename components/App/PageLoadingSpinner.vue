<script setup>
const isLoading = ref(false);
let hideTimer;
let cleanup = [];

const showLoader = () => {
  clearTimeout(hideTimer);
  isLoading.value = true;
};

const hideLoader = () => {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    isLoading.value = false;
  }, 120);
};

onMounted(() => {
  const nuxtApp = useNuxtApp();
  const router = useRouter();

  cleanup = [
    nuxtApp.hooks.hook("page:start", showLoader),
    nuxtApp.hooks.hook("page:finish", hideLoader),
    nuxtApp.hooks.hook("app:error", hideLoader),
    router.beforeEach((to, from) => {
      if (to.fullPath !== from.fullPath) {
        showLoader();
      }
    }),
    router.afterEach(hideLoader),
    router.onError(hideLoader),
  ].filter(Boolean);
});

onBeforeUnmount(() => {
  clearTimeout(hideTimer);
  cleanup.forEach((unregister) => unregister());
});
</script>

<template>
  <ClientOnly>
    <Transition name="page-loading-spinner">
      <div
        v-if="isLoading"
        class="page-loading-spinner"
        aria-label="Cargando pagina"
        role="status"
      >
        <span class="page-loading-spinner__ring"></span>
      </div>
    </Transition>
  </ClientOnly>
</template>

<style scoped>
.page-loading-spinner {
  position: fixed;
  top: 0.625rem;
  right: 0.5rem;
  z-index: 2147483647;
  display: flex;
  width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(226 232 240 / 0.9);
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.88);
  box-shadow: 0 10px 30px rgb(15 23 42 / 0.16);
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.page-loading-spinner__ring {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid rgb(148 163 184 / 0.38);
  border-top-color: rgb(20 184 166);
  border-radius: 9999px;
  animation: page-loading-spinner-rotate 0.75s linear infinite;
}

.page-loading-spinner-enter-active,
.page-loading-spinner-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.page-loading-spinner-enter-from,
.page-loading-spinner-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

@media (min-width: 640px) {
  .page-loading-spinner {
    right: 1.25rem;
  }
}

:global(.dark) .page-loading-spinner {
  border-color: rgb(51 65 85 / 0.85);
  background: rgb(15 23 42 / 0.78);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.3);
}

:global(.dark) .page-loading-spinner__ring {
  border-color: rgb(100 116 139 / 0.42);
  border-top-color: rgb(45 212 191);
}

@keyframes page-loading-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
