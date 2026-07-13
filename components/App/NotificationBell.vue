<script setup>
import { IconBell, IconChecks, IconBellOff } from '@tabler/icons-vue'

/*
 * App.NotificationBell — campana del top bar: dropdown flotante (Preline hs-dropdown)
 * con lista de notificaciones del usuario, badge de no leídas, tabs Todas/No leídas
 * y footer "Marcar todas" + "Ver todas". Estilo calcado del template CRM.
 *
 * Backend: notification center de innertia-laravel (vía useNotifications).
 * `allRoute`: ruta de la vista "ver todas" (cada producto monta la suya).
 */
const props = defineProps({
  allRoute: { type: String, default: '/backoffice/notifications' },
})

const { fetchNotifications, markAsRead, markAllAsRead } = useNotifications()
const store = useNotificationsStore()

const tab = ref('all')            // all | unread
const loading = ref(false)
const serverUnread = ref(0)       // conteo exacto de no leídas (del backend)
const ddRoot = ref(null)

// Cierra el dropdown Preline al navegar (--auto-close:false para que los tabs no lo cierren).
function closeDropdown() {
  try { window.HSDropdown?.close?.(ddRoot.value) } catch { /* noop */ }
}

const items = computed(() => tab.value === 'unread'
  ? store.notifications.filter(n => !n.read_at)
  : store.notifications)

const liveUnread = computed(() => Math.max(serverUnread.value, store.unreadCount))
const badge = computed(() => liveUnread.value > 9 ? '9+' : String(liveUnread.value))

async function load() {
  loading.value = true
  try {
    const res = await fetchNotifications({ all: 1 })
    serverUnread.value = res?.unread ?? store.unreadCount
  } catch { /* noop */ } finally {
    loading.value = false
  }
}
onMounted(load)

async function openItem(n) {
  if (!n.read_at) {
    try {
      await markAsRead(n.id)
      serverUnread.value = Math.max(0, serverUnread.value - 1)
    } catch { /* noop */ }
  }
  const link = n.data?.link ?? n.data?.url
  if (link) { closeDropdown(); navigateTo(link) }
}

function goAll() {
  closeDropdown()
  navigateTo(props.allRoute)
}

async function markAll() {
  try {
    await markAllAsRead()
    serverUnread.value = 0
  } catch { /* noop */ }
}

const initial = (t) => (t || '?').trim().charAt(0).toUpperCase()

function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'hace un momento'
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`
  const days = Math.floor(h / 24); if (days < 7) return `hace ${days} d`
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div ref="ddRoot" class="hs-dropdown [--placement:bottom-right] [--auto-close:false] relative inline-flex">
    <!-- Botón campana -->
    <button
      id="hs-notifications-dd"
      type="button"
      class="relative inline-flex justify-center items-center size-9 rounded-full text-foreground-inverse hover:bg-plain/10 focus:outline-hidden"
      aria-haspopup="menu" aria-expanded="false" aria-label="Notificaciones"
      @click="load"
    >
      <IconBell class="size-4 shrink-0" />
      <span
        v-if="serverUnread > 0"
        class="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 inline-flex justify-center items-center text-[10px] font-semibold leading-none text-white bg-red-500 rounded-full"
      >{{ badge }}</span>
    </button>

    <!-- Dropdown -->
    <div
      class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-90 max-w-[calc(100vw-2rem)] transition-[opacity,margin] duration opacity-0 hidden z-20 bg-dropdown border border-dropdown-line rounded-xl shadow-xl overflow-hidden"
      role="menu" aria-orientation="vertical" aria-labelledby="hs-notifications-dd"
    >
      <!-- Header + tabs (subrayado after inset, estilo template) -->
      <div class="px-5 pt-3 flex justify-between items-center border-b border-dropdown-divider">
        <nav class="flex gap-1" role="tablist">
          <button
            type="button"
            class="relative px-2 py-1.5 mb-2 inline-flex justify-center items-center gap-x-2 text-sm rounded-lg hover:bg-muted-hover after:absolute after:-bottom-2 after:inset-x-2 after:z-10 after:h-0.5 after:pointer-events-none transition-colors"
            :class="tab === 'all' ? 'text-foreground after:bg-secondary' : 'text-muted-foreground-1 hover:text-foreground after:bg-transparent'"
            @click="tab = 'all'"
          >Todas</button>
          <button
            type="button"
            class="relative px-2 py-1.5 mb-2 inline-flex justify-center items-center gap-x-2 text-sm rounded-lg hover:bg-muted-hover after:absolute after:-bottom-2 after:inset-x-2 after:z-10 after:h-0.5 after:pointer-events-none transition-colors"
            :class="tab === 'unread' ? 'text-foreground after:bg-secondary' : 'text-muted-foreground-1 hover:text-foreground after:bg-transparent'"
            @click="tab = 'unread'"
          >No leídas<span v-if="serverUnread" class="ms-1 text-xs text-muted-foreground">({{ serverUnread }})</span></button>
        </nav>
      </div>

      <!-- Lista -->
      <div class="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-card-line">
        <!-- Loading -->
        <div v-if="loading && !store.notifications.length" class="p-4 space-y-4">
          <div v-for="i in 4" :key="i" class="flex gap-3 animate-pulse">
            <span class="size-9 rounded-full bg-surface-1 shrink-0" />
            <div class="flex-1 space-y-2"><span class="block h-3 w-1/3 bg-surface-1 rounded" /><span class="block h-3 w-3/4 bg-surface-1 rounded" /></div>
          </div>
        </div>

        <!-- Vacío -->
        <div v-else-if="!items.length" class="py-12 flex flex-col items-center text-center text-muted-foreground">
          <IconBellOff class="size-8 mb-2 opacity-30" :stroke-width="1.5" />
          <p class="text-sm">{{ tab === 'unread' ? 'Sin notificaciones nuevas.' : 'No tienes notificaciones.' }}</p>
        </div>

        <!-- Items -->
        <ul v-else class="divide-y divide-dropdown-divider">
          <li
            v-for="n in items" :key="n.id"
            class="relative w-full flex gap-x-3 p-4 cursor-pointer hover:bg-muted-hover transition-colors"
            :class="!n.read_at ? 'bg-surface' : ''"
            @click="openItem(n)"
          >
            <div class="relative shrink-0">
              <span class="flex items-center justify-center size-9 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase">{{ initial(n.title) }}</span>
              <span v-if="!n.read_at" class="absolute -top-0.5 -start-0.5 size-2.5 bg-primary rounded-full ring-2 ring-dropdown" />
            </div>
            <div class="grow min-w-0">
              <p class="text-xs text-muted-foreground">{{ timeAgo(n.created_at) }}</p>
              <p class="text-sm font-medium text-foreground">{{ n.title }}</p>
              <p v-if="n.body" class="text-sm text-muted-foreground line-clamp-2">{{ n.body }}</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- Footer -->
      <div class="flex items-center border-t border-dropdown-divider divide-x divide-dropdown-divider">
        <button
          v-if="serverUnread > 0"
          type="button"
          class="flex-1 p-4 flex justify-center items-center gap-x-2 text-sm font-medium text-muted-foreground-1 hover:text-primary-hover focus:outline-hidden"
          @click="markAll"
        >
          <IconChecks class="size-4 shrink-0" />
          Marcar todas como leídas
        </button>
        <button
          type="button"
          class="flex-1 p-4 flex justify-center items-center gap-x-2 text-sm font-medium text-muted-foreground-1 hover:text-primary-hover focus:outline-hidden"
          @click="goAll"
        >
          Ver todas
        </button>
      </div>
    </div>
  </div>
</template>
