<script setup lang="ts">
const props = defineProps<{
  floating?: boolean
  user?: { name?: string; email?: string } | null
  menuSize?: string
}>()

const emit = defineEmits<{ logout: [] }>()

const isOpen = ref(false)
const open  = () => { isOpen.value = true }
const close = () => { isOpen.value = false }

provide('spark:sidebar', { isOpen, open, close })

const userInitial = computed(() =>
  props.user?.name?.charAt(0).toUpperCase() ?? props.user?.email?.charAt(0).toUpperCase() ?? 'U'
)

const config = useRuntimeConfig()
const appEnv = config.public.appEnv as string | undefined

const envLabel = computed(() => {
  switch (appEnv) {
    case 'local':      return 'Entorno local'
    case 'dev':        return 'Entorno dev'
    case 'staging':    return 'Staging'
    case 'production': return null
    default:           return appEnv ?? null
  }
})
</script>

<template>
  <div class="bg-background-1 min-h-screen">

    <!-- Mobile backdrop -->
    <Transition
      enter-from-class="opacity-0" enter-active-class="transition-opacity duration-300"
      leave-to-class="opacity-0"   leave-active-class="transition-opacity duration-300"
    >
      <div v-if="isOpen" class="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" @click="close" />
    </Transition>

    <!-- Sidebar -->
    <aside
      tabindex="-1"
      aria-label="Sidebar"
      :class="[
        'fixed inset-y-0 start-0 z-60 w-65',
        'transition-transform duration-300 lg:translate-x-0',
        isOpen ? 'translate-x-0' : 'max-lg:-translate-x-full',
        floating ? 'p-3' : '',
      ]"
    >
      <div
        :class="[
          'flex flex-col h-full',
          floating
            ? 'bg-sidebar rounded-2xl border border-sidebar-line shadow-sm overflow-hidden'
            : 'bg-sidebar border-e border-sidebar-line',
        ]"
      >
        <!-- Logo + mobile close -->
        <header class="flex items-center gap-x-1 px-3 pt-4 pb-5 shrink-0">
          <div class="flex-1 min-w-0">
            <slot name="logo" />
          </div>
          <button
            type="button"
            class="lg:hidden size-7 inline-flex justify-center items-center rounded-lg text-muted-foreground hover:bg-muted-hover transition-colors"
            @click="close"
          >
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <!-- Search -->
        <div v-if="$slots.search" class="px-3 pb-2 shrink-0">
          <slot name="search" />
        </div>

        <!-- Nav menu (scrollable) -->
        <div
          :class="[
            'flex-1 min-h-0 overflow-y-auto',
            '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-scrollbar-thumb',
            menuSize ?? 'text-sm',
          ]"
        >
          <slot name="menu" />
        </div>

        <!-- User footer -->
        <div class="shrink-0 border-t border-sidebar-line px-3 pt-5 pb-3 space-y-2">

          <!-- Controls slot (dark mode, notifications, etc.) -->
          <div v-if="$slots['user-controls']" class="flex items-center gap-x-1.5">
            <slot name="user-controls" />
          </div>

          <!-- User info + logout -->
          <div v-if="user" class="flex items-center gap-x-3">
            <div class="size-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0 select-none">
              {{ userInitial }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-foreground truncate">{{ user.name ?? user.email }}</p>
              <p v-if="user.name && user.email" class="text-xs text-muted-foreground truncate">{{ user.email }}</p>
            </div>
            <button
              type="button"
              class="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors shrink-0"
              title="Cerrar sesión"
              @click="emit('logout')"
            >
              <svg class="size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 9l3 3m0 0l-3 3m3-3H9" />
              </svg>
            </button>
          </div>

          <!-- Env / extra slot -->
          <slot name="user-footer" />
        </div>

        <!-- Environment banner — full width, outside the padded footer -->
        <div v-if="envLabel" class="shrink-0 flex items-center justify-center gap-x-2 py-2 bg-amber-400/15 border-t border-amber-400/30">
          <span class="size-1.5 rounded-full bg-amber-400 shrink-0"></span>
          <span class="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">{{ envLabel }}</span>
        </div>

      </div>
    </aside>

    <!-- Main content -->
    <div class="lg:ps-65 p-3">
      <slot />
    </div>

  </div>
</template>
