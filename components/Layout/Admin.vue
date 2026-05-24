<script setup>
const showAnimation = ref(false)
onMounted(() => {
  const seen = sessionStorage.getItem('auth-entered')
  if (!seen) {
    showAnimation.value = true
    sessionStorage.setItem('auth-entered', 'true')
  }
})
</script>

<template>
  <div :class="{ 'animate-entrance': showAnimation }">
    <AdminBase>
      <template #logo><slot name="logo" /></template>
      <template #menu><slot name="menu" /></template>
      <template #user-footer><slot name="user-footer" /></template>

      <div class="lg:ps-65">
        <slot />
      </div>
    </AdminBase>
  </div>
</template>

<style scoped>
.animate-entrance { animation: fadeInScale 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.96); filter: blur(4px); }
  to   { opacity: 1; transform: scale(1);    filter: blur(0);   }
}
</style>
