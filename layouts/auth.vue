<script setup lang="ts">
/**
 * Layout para flujos de autenticación (login, recovery, register).
 *
 * Estructura:
 *   [Panel marketing (lg+ only)] [Form area: header (theme switch) | slot | footer (© + version)]
 *
 * Configurable via:
 *   - `appConfig.innertia.branding.name` y `branding.version` (footer)
 *   - `appConfig.innertia.marketing.*` (panel izquierdo — typewriter, tagline, footer)
 *   - `appConfig.innertia.colors.primary` (color de acentos)
 *
 * Slots disponibles:
 *   - `marketing` — sobreescribe el panel izquierdo entero
 *   - `logo`      — sobreescribe el logo del topbar mobile (default: /isologo-{light,dark}.png)
 *   - default     — contenido del formulario (login/recovery/register)
 */

onMounted(() => {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('auth-entered')
})

const appConfig = useAppConfig()
const branding = computed(() => appConfig.innertia?.branding ?? { name: 'Innertia', version: '' })
</script>

<template>
  <div class="min-h-screen flex bg-white dark:bg-slate-900">

    <!-- ── Columna izquierda: marketing panel ─────────────────────────────── -->
    <slot name="marketing">
      <AuthMarketingPanel />
    </slot>

    <!-- ── Columna derecha: formulario ────────────────────────────────────── -->
    <div class="flex flex-1 flex-col">

      <!-- Barra superior -->
      <div class="relative flex items-center justify-end px-6 pt-5">
        <!-- Logo centrado en mobile (oculto en lg+) -->
        <div class="lg:hidden absolute inset-x-0 px-6 flex justify-center pointer-events-none">
          <div class="w-full max-w-sm flex">
            <NuxtLink to="/" class="pointer-events-auto">
              <slot name="logo">
                <img src="/isologo-light.png" :alt="branding.name" class="h-7 dark:hidden" />
                <img src="/isologo-dark.png" :alt="branding.name" class="h-7 hidden dark:block" />
              </slot>
            </NuxtLink>
          </div>
        </div>
        <AppSwitchColorTheme />
      </div>

      <!-- Contenido del formulario -->
      <div class="flex flex-1 items-center justify-center px-6 py-10">
        <div class="w-full max-w-sm">
          <Transition name="auth-content" mode="out-in">
            <slot />
          </Transition>
        </div>
      </div>

      <!-- Pie de página: © {nombre} - v{version} -->
      <div class="flex items-center justify-end gap-x-2 px-6 pb-5">
        <span class="text-xs text-slate-400 dark:text-slate-600">
          © {{ new Date().getFullYear() }} {{ branding.name }}
        </span>
        <template v-if="branding.version">
          <span class="text-xs text-slate-300 dark:text-slate-700">-</span>
          <span class="text-xs text-slate-400 dark:text-slate-600">v{{ branding.version }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
.auth-content-enter-active,
.auth-content-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.auth-content-enter-from,
.auth-content-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
