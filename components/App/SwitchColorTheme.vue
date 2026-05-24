<script setup>
const isDark = ref(false)

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
})

async function setTheme(value) {
  const dark = value === 'dark'
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('hs_theme', value)
  document.cookie = `hs_theme=${value};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`

  try {
    const api = useApi()
    await api.put('auth/me/preferences/appearance', { value })
  } catch { /* best-effort */ }
}
</script>

<template>
  <button
    v-if="isDark"
    type="button"
    class="font-medium text-slate-800 rounded-full hover:bg-surface focus:outline-hidden focus:bg-surface dark:text-foreground dark:hover:bg-card dark:focus:bg-card"
    @click="setTheme('light')"
  >
    <span class="group inline-flex shrink-0 justify-center items-center size-9">
      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2"></path><path d="M12 20v2"></path>
        <path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path>
        <path d="M2 12h2"></path><path d="M20 12h2"></path>
        <path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>
      </svg>
    </span>
  </button>
  <button
    v-else
    type="button"
    class="font-medium text-slate-400 rounded-full hover:bg-surface focus:outline-hidden focus:bg-surface dark:text-foreground dark:hover:bg-card dark:focus:bg-card"
    @click="setTheme('dark')"
  >
    <span class="group inline-flex shrink-0 justify-center items-center size-9">
      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
      </svg>
    </span>
  </button>
</template>
