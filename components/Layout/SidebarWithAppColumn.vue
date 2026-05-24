<script setup lang="ts">
import * as TablerIcons from '@tabler/icons-vue'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavItem {
  label:    string
  icon:     string
  route:    string
  pattern?: string
}

interface AppItem {
  label:  string
  icon:   string
  route:  string
  bg?:    string
  text?:  string
  nav?:   NavItem[]
}

interface MenuItem {
  label:     string
  icon:      string
  route?:    string
  pattern?:  string
  children?: NavItem[]
}

// ─── Props / Emits ────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  appItems?:  AppItem[]
  menuItems?: MenuItem[]
  homeRoute?: string
  user?:      { name?: string; email?: string } | null
  floating?:  boolean
}>(), {
  appItems:  () => [],
  menuItems: () => [],
  homeRoute: '/',
})

const emit = defineEmits<{ logout: [] }>()

// ─── Mobile sidebar ───────────────────────────────────────────────────────────

const isOpen = ref(false)
const open  = () => { isOpen.value = true }
const close = () => { isOpen.value = false }
provide('innertia:sidebar', { isOpen, open, close })

// ─── Route matching ───────────────────────────────────────────────────────────

const route = useRoute()

const matchPattern = (pattern?: string) => {
  if (!pattern) return false
  return new RegExp('^' + pattern.replace(/\*/g, '.*') + '$').test(route.path)
}

const isChildActive = (children?: NavItem[]) =>
  children?.some(c => matchPattern(c.pattern ?? c.route + '/*')) ?? false

// ─── Active app detection ─────────────────────────────────────────────────────

const currentApp = computed(() =>
  props.appItems.find(a => route.path.startsWith(a.route)) ?? null
)
const isInApp = computed(() => !!currentApp.value)

// ─── Hover preview ────────────────────────────────────────────────────────────

const hoveredApp = ref<AppItem | 'home' | null>(null)

const previewApp = computed(() =>
  hoveredApp.value && hoveredApp.value !== 'home'
    ? hoveredApp.value as AppItem
    : currentApp.value
)

const showMainMenu = computed(() =>
  hoveredApp.value === 'home' || (!hoveredApp.value && !isInApp.value)
)

watch(isInApp, (val) => { if (!val) hoveredApp.value = null })

// ─── Main menu accordion ──────────────────────────────────────────────────────

const openAccordions = ref<Record<number, boolean>>({})
const toggleAccordion = (i: number) => { openAccordions.value[i] = !openAccordions.value[i] }

watch(() => route.path, () => {
  let active = -1
  props.menuItems.forEach((item, i) => {
    if (item.children && (matchPattern(item.pattern) || isChildActive(item.children))) active = i
  })
  openAccordions.value = active !== -1 ? { [active]: true } : {}
}, { immediate: true })

// ─── User / env ───────────────────────────────────────────────────────────────

const userInitial = computed(() =>
  props.user?.name?.charAt(0).toUpperCase() ??
  props.user?.email?.charAt(0).toUpperCase() ?? 'U'
)

const config   = useRuntimeConfig()
const appEnv   = config.public.appEnv as string | undefined
const envLabel = computed(() => (!appEnv || appEnv === 'production') ? null : appEnv)

// ─── Icon resolver ────────────────────────────────────────────────────────────

const icon = (name: string) => (TablerIcons as Record<string, unknown>)[name]
</script>

<template>
  <div class="bg-background-1 min-h-screen">

    <!-- Mobile backdrop -->
    <Transition
      enter-from-class="opacity-0" enter-active-class="transition-opacity duration-300"
      leave-to-class="opacity-0"   leave-active-class="transition-opacity duration-300"
    >
      <div
        v-if="isOpen"
        class="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        @click="close"
      />
    </Transition>

    <!-- ═══ SIDEBAR ════════════════════════════════════════════════════════════ -->
    <aside
      :class="[
        'fixed inset-y-0 start-0 z-60 w-65',
        'transition-transform duration-300 lg:translate-x-0',
        isOpen ? 'translate-x-0' : 'max-lg:-translate-x-full',
        floating ? 'p-3' : '',
      ]"
    >
      <div
        :class="[
          'flex flex-col h-full bg-sidebar',
          floating
            ? 'rounded-2xl border border-sidebar-line shadow-sm overflow-hidden'
            : 'border-e border-sidebar-line',
        ]"
      >

        <!-- Logo ─────────────────────────────────────────────────────────────── -->
        <header class="px-4 pt-4 pb-3 border-b border-sidebar-line shrink-0 flex items-center gap-x-2">
          <div class="flex-1 min-w-0">
            <slot name="logo" />
          </div>
          <!-- Mobile close -->
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

        <!-- Search (optional) ───────────────────────────────────────────────── -->
        <div v-if="$slots.search" class="px-3 pb-2 border-b border-sidebar-line shrink-0">
          <slot name="search" />
        </div>

        <!-- Body: icon strip + right panel ──────────────────────────────────── -->
        <div class="flex flex-1 min-h-0" @mouseleave="hoveredApp = null">

          <!-- ── Icon strip (50 px) ──────────────────────────────────────────── -->
          <div class="w-[50px] shrink-0 flex flex-col relative">

            <!-- Separator line (behind strip items via z-0) -->
            <span class="pointer-events-none absolute right-0 inset-y-0 w-px bg-sidebar-line z-0" />

            <div class="flex-1 flex flex-col py-2 gap-1.5 overflow-y-auto relative z-10">

              <!-- Home button -->
              <NuxtLink
                :to="homeRoute"
                class="group relative flex items-center justify-center h-12 border border-r-0"
                :class="!isInApp
                  ? 'ml-[2px] bg-card border-sidebar-line rounded-l-lg'
                  : 'ml-[1px] w-12 border-transparent rounded-lg'"
                @mouseenter="hoveredApp = 'home'"
              >
                <span
                  class="size-10 flex items-center justify-center rounded-lg shrink-0 transition-opacity duration-150 bg-surface text-muted-foreground"
                  :class="!isInApp ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'"
                >
                  <component :is="icon('IconHome')" class="size-[22px]" />
                </span>
              </NuxtLink>

              <!-- App items -->
              <NuxtLink
                v-for="app in appItems"
                :key="app.route"
                :to="app.route"
                class="group relative flex items-center justify-center h-12 border border-r-0"
                :class="route.path.startsWith(app.route)
                  ? 'ml-[2px] bg-card border-sidebar-line rounded-l-lg'
                  : 'ml-[1px] w-12 border-transparent rounded-lg'"
                @mouseenter="hoveredApp = app"
              >
                <span
                  class="size-10 flex items-center justify-center rounded-lg shrink-0 transition-opacity duration-150"
                  :class="[
                    app.bg ?? 'bg-surface',
                    app.text ?? 'text-muted-foreground',
                    route.path.startsWith(app.route) ? 'opacity-100' : 'opacity-50 group-hover:opacity-100',
                  ]"
                >
                  <component :is="icon(app.icon)" class="size-[22px]" />
                </span>
              </NuxtLink>

            </div>
          </div>
          <!-- /icon strip -->

          <!-- ── Right panel ─────────────────────────────────────────────────── -->
          <div class="flex-1 relative overflow-hidden bg-card">

            <!-- MAIN MENU -->
            <Transition name="panel-swap">
              <div v-if="showMainMenu" key="main" class="absolute inset-0 overflow-y-auto">
                <ul class="flex flex-col gap-y-1 px-3 pt-2 pb-3">
                  <li v-for="(item, index) in menuItems" :key="'menu-' + index">

                    <!-- Simple link -->
                    <NuxtLink
                      v-if="!item.children && item.route"
                      :to="item.route"
                      class="flex items-center gap-x-3 py-2 px-3 text-sm text-muted-foreground rounded-lg hover:bg-muted-hover transition-all border border-transparent"
                      :class="{ 'bg-surface text-foreground font-semibold border-card-line': matchPattern(item.pattern ?? item.route) }"
                    >
                      <component :is="icon(item.icon)" class="shrink-0 size-4" />
                      {{ item.label }}
                    </NuxtLink>

                    <!-- Accordion group -->
                    <div v-else-if="item.children" class="flex flex-col">
                      <button
                        type="button"
                        class="w-full text-start flex items-center gap-x-3 py-2 px-3 text-sm text-muted-foreground rounded-lg hover:bg-muted-hover transition-all"
                        :class="{ 'bg-muted text-foreground font-semibold': openAccordions[index] }"
                        @click="toggleAccordion(index)"
                      >
                        <component :is="icon(item.icon)" class="shrink-0 size-4" />
                        <span class="flex-1">{{ item.label }}</span>
                        <component
                          :is="icon('IconChevronDown')"
                          class="shrink-0 size-4 transition-transform duration-300"
                          :class="{ '-rotate-180': openAccordions[index] }"
                        />
                      </button>
                      <div
                        class="overflow-hidden transition-all duration-300 ease-in-out"
                        :style="{
                          maxHeight: openAccordions[index] ? '300px' : '0px',
                          opacity:   openAccordions[index] ? '1'    : '0',
                          marginTop: openAccordions[index] ? '4px'  : '0px',
                        }"
                      >
                        <ul class="ps-8 flex flex-col gap-y-1 relative before:absolute before:start-4.5 before:w-px before:h-full before:bg-sidebar-line">
                          <li v-for="child in item.children" :key="child.route">
                            <NuxtLink
                              :to="child.route"
                              class="flex items-center gap-x-4 py-2 px-3 text-sm text-muted-foreground rounded-lg hover:bg-muted-hover transition-colors border border-transparent"
                              :class="{ 'bg-surface text-foreground font-semibold': matchPattern(child.pattern ?? child.route) }"
                            >
                              <component :is="icon(child.icon)" class="shrink-0 size-4" />
                              {{ child.label }}
                            </NuxtLink>
                          </li>
                        </ul>
                      </div>
                    </div>

                  </li>
                </ul>
              </div>
            </Transition>

            <!-- APP SUBNAV -->
            <Transition name="panel-swap">
              <div v-if="!showMainMenu" :key="previewApp?.route ?? 'app'" class="absolute inset-0 flex flex-col">
                <div class="px-3 pt-3 pb-3 border-b border-sidebar-line shrink-0">
                  <span class="text-[13px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                    {{ previewApp?.label }}
                  </span>
                </div>
                <nav class="flex-1 overflow-y-auto py-2 px-2">
                  <ul class="flex flex-col gap-0.5">
                    <li v-for="item in (previewApp?.nav ?? [])" :key="item.route">
                      <NuxtLink
                        :to="item.route"
                        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted-hover transition-colors border border-transparent"
                        :class="{ 'bg-surface text-foreground font-semibold border-card-line': matchPattern(item.pattern ?? item.route + '*') }"
                      >
                        <component :is="icon(item.icon)" class="size-4 shrink-0" />
                        {{ item.label }}
                      </NuxtLink>
                    </li>
                  </ul>
                </nav>
              </div>
            </Transition>

          </div>
          <!-- /right panel -->

        </div>
        <!-- /body -->

        <!-- Footer ───────────────────────────────────────────────────────────── -->
        <div class="shrink-0 border-t border-sidebar-line">

          <!-- Controls slot (dark mode, notifications, etc.) -->
          <div v-if="$slots['user-controls']" class="flex items-center gap-x-1.5 px-3 pt-3">
            <slot name="user-controls" />
          </div>

          <!-- User info + logout -->
          <div v-if="user" class="flex items-center gap-x-3 px-3 py-3">
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

          <!-- Extra footer slot -->
          <slot name="user-footer" />

          <!-- Env banner -->
          <div
            v-if="envLabel"
            class="flex items-center justify-center gap-x-2 py-2 bg-amber-400/15 border-t border-amber-400/30"
          >
            <span class="size-1.5 rounded-full bg-amber-400 shrink-0" />
            <span class="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
              {{ envLabel }}
            </span>
          </div>

        </div>
        <!-- /footer -->

      </div>
    </aside>

    <!-- ═══ MAIN CONTENT ══════════════════════════════════════════════════════ -->
    <div class="lg:ps-65 flex flex-col min-h-screen">
      <slot name="topbar" />
      <div class="flex-1 min-h-0">
        <slot />
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Panel swap animation */
.panel-swap-enter-active,
.panel-swap-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.panel-swap-enter-from   { opacity: 0; transform: translateX(10px);  }
.panel-swap-leave-to     { opacity: 0; transform: translateX(-10px); }
</style>
