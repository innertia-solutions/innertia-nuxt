<script setup lang="ts">
/**
 * Layout backoffice estándar — topbar oscuro con logo + menú + user dropdown.
 *
 * Configurable via `appConfig.innertia.menu` (items principales) y
 * `appConfig.innertia.menuApps` (apps secundarias, opcional para layouts dobles).
 *
 * Slots disponibles:
 *   - `search` — contenido del centro del topbar (ej. buscador AI). Default: vacío.
 *   - `logo`   — sobreescribe el logo. Default: /isologo-{light,dark}.png + link a home del primer contexto.
 *   - default  — contenido principal de la página.
 */
import * as icons from '@tabler/icons-vue'

interface MenuItem {
  label: string
  icon: string
  route: string
  pattern?: string
}

const { logout } = useAuth()
const authStore = useAuthStore()
const { isDark, toggle } = useTheme()
const { docked } = useDockedPreviews()
const route = useRoute()
const appConfig = useAppConfig()

// Organizaciones — picker se muestra si el feature está activo y el user
// tiene 2+ orgs sin elegir todavía. Bloquea el contenido detrás.
const { needsPicker: needsOrgPicker } = useOrganization()

const branding = computed(() => appConfig.innertia?.branding ?? { name: 'Innertia' })
const menuItems = computed<MenuItem[]>(() => (appConfig.innertia?.menu ?? []) as MenuItem[])
const menuApps  = computed<MenuItem[]>(() => (appConfig.innertia?.menuApps ?? []) as MenuItem[])

const matchPattern = (pattern: string | undefined, fallback: string) => {
  const p = pattern || fallback
  if (!p) return false
  const regex = new RegExp('^' + p.replace(/\*/g, '.*') + '$')
  return regex.test(route.path)
}

const mobileOpen = ref(false)
watch(() => route.path, () => { mobileOpen.value = false })

const userInitial = computed(() =>
  (authStore.user as any)?.name?.charAt(0)?.toUpperCase()
  ?? (authStore.user as any)?.email?.charAt(0)?.toUpperCase()
  ?? 'U'
)

// Default home — primer item del menu o '/'
const homeRoute = computed(() => menuItems.value[0]?.route ?? '/')
</script>

<template>
  <div class="relative bg-background min-h-screen">
    <!-- Dot pattern background -->
    <div
      class="fixed inset-0 pointer-events-none dark:hidden"
      style="background-image: radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px); background-size: 20px 20px; opacity: 0.5;"
    />
    <div
      class="fixed inset-0 pointer-events-none hidden dark:block"
      style="background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px); background-size: 20px 20px;"
    />

    <!-- ========== HEADER ========== -->
    <header class="flex flex-col z-50 sticky top-0">

      <!-- Top bar -->
      <div class="relative overflow-hidden bg-navbar-inverse border-b border-navbar-divider">
        <div class="max-w-[85rem] flex justify-between lg:grid lg:grid-cols-3 basis-full items-center w-full mx-auto py-1.5 px-4 sm:px-6 lg:px-8">

          <!-- Left: Logo + mobile hamburger -->
          <div class="flex items-center gap-x-3">
            <slot name="logo">
              <NuxtLink :to="homeRoute" class="flex-none ml-1">
                <img :src="'/isologo-light.png'" class="h-6 w-auto dark:hidden" :alt="branding.name" />
                <img :src="'/isologo-dark.png'" class="h-6 w-auto hidden dark:block" :alt="branding.name" />
              </NuxtLink>
            </slot>
            <button
              type="button"
              class="lg:hidden inline-flex justify-center items-center size-9 rounded-lg text-foreground-inverse hover:bg-plain/10 focus:outline-hidden"
              @click="mobileOpen = !mobileOpen"
              :aria-expanded="mobileOpen"
              aria-label="Toggle navigation"
            >
              <icons.IconMenu2 v-if="!mobileOpen" class="size-4 shrink-0" />
              <icons.IconX v-else class="size-4 shrink-0" />
            </button>
          </div>

          <!-- Center: slot custom (ej. buscador AI) -->
          <div class="hidden lg:flex justify-center">
            <slot name="search" />
          </div>

          <!-- Right: theme toggle + alerts + user -->
          <div class="flex items-center justify-end gap-x-1">

            <button
              type="button"
              class="inline-flex justify-center items-center size-9 rounded-full text-foreground-inverse hover:bg-plain/10 focus:outline-hidden"
              @click="toggle"
              :title="isDark ? 'Modo claro' : 'Modo oscuro'"
            >
              <icons.IconSun v-if="isDark" class="size-4 shrink-0" />
              <icons.IconMoon v-else class="size-4 shrink-0" />
            </button>

            <OrganizationSwitcher />
            <slot name="topbar-actions" />

            <div class="hidden sm:block w-px h-6 bg-navbar-divider/20 mx-1" />

            <!-- User dropdown -->
            <div class="hs-dropdown [--placement:bottom-right] relative inline-flex">
              <button
                type="button"
                class="inline-flex shrink-0 items-center rounded-full focus:outline-hidden"
                aria-haspopup="menu"
                aria-label="Cuenta"
              >
                <div class="size-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold select-none">
                  {{ userInitial }}
                </div>
              </button>

              <div
                class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-60 transition-[opacity,margin] opacity-0 hidden z-20 bg-dropdown border border-dropdown-line rounded-xl shadow-xl"
                role="menu"
              >
                <div class="p-1 border-b border-dropdown-divider">
                  <div class="py-2 px-3 flex items-center gap-x-3">
                    <div class="size-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
                      {{ userInitial }}
                    </div>
                    <div class="grow min-w-0">
                      <p class="text-sm font-semibold text-foreground truncate">
                        {{ (authStore.user as any)?.name ?? (authStore.user as any)?.email }}
                      </p>
                      <p v-if="(authStore.user as any)?.name && (authStore.user as any)?.email" class="text-xs text-muted-foreground truncate">
                        {{ (authStore.user as any).email }}
                      </p>
                    </div>
                  </div>
                </div>
                <div class="p-1">
                  <button
                    type="button"
                    class="w-full flex items-center gap-x-3 py-2 px-3 rounded-lg text-sm text-dropdown-item-foreground hover:bg-dropdown-item-hover focus:outline-hidden"
                    @click="logout"
                  >
                    <icons.IconLogout class="shrink-0 size-4" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Secondary navbar (menu items + app items) -->
      <nav v-if="menuItems.length > 0 || menuApps.length > 0" class="bg-navbar border-b border-navbar-line">
        <div class="max-w-[85rem] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div
            class="overflow-hidden transition-all duration-300 lg:block"
            :class="mobileOpen ? 'block' : 'hidden'"
          >
            <div class="flex flex-col lg:flex-row lg:items-center lg:gap-x-1 py-1.5 space-y-0.5 lg:space-y-0">
              <NuxtLink
                v-for="item in menuItems"
                :key="item.route"
                :to="item.route"
                class="py-1.5 px-2.5 flex items-center gap-x-2 text-[13px] text-nowrap text-navbar-nav-foreground rounded-lg hover:bg-navbar-nav-hover focus:outline-hidden"
                :class="{ 'bg-navbar-nav-active': matchPattern(item.pattern, item.route) }"
              >
                <component :is="(icons as any)[item.icon]" class="shrink-0 size-4" />
                {{ item.label }}
              </NuxtLink>
              <NuxtLink
                v-for="item in menuApps"
                :key="item.route"
                :to="item.route"
                class="py-1.5 px-2.5 flex items-center gap-x-2 text-[13px] text-nowrap text-navbar-nav-foreground rounded-lg hover:bg-navbar-nav-hover focus:outline-hidden"
                :class="{ 'bg-navbar-nav-active': matchPattern(item.pattern, item.route + '/*') }"
              >
                <component :is="(icons as any)[item.icon]" class="shrink-0 size-4" />
                {{ item.label }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </nav>

    </header>

    <!-- Main content -->
    <main
      class="max-w-[85rem] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 transition-[padding]"
      :class="docked.length ? 'pb-20' : ''"
    >
      <slot />
    </main>

    <!-- Preview dock (previews minimizados de tablas) -->
    <AppPreviewDock />

    <!-- Organization picker — overlay full-screen cuando aplica -->
    <OrganizationPicker v-if="needsOrgPicker" />
  </div>
</template>
