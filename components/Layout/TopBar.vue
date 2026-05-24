<script setup lang="ts">
// ─── Props / Emits ────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  user?:                { name?: string; email?: string; role?: string } | null
  notificationsCount?:  number
  searchPlaceholder?:   string
  showSearch?:          boolean
  showNotifications?:   boolean
  showUser?:            boolean
}>(), {
  user:                 null,
  notificationsCount:   0,
  searchPlaceholder:    'Buscar…',
  showSearch:           true,
  showNotifications:    true,
  showUser:             true,
})

const emit = defineEmits<{
  search:              [query: string]
  'notification-click': []
  logout:              []
}>()

// ─── Search ───────────────────────────────────────────────────────────────────

const searchQuery = ref('')

const handleSearch = () => emit('search', searchQuery.value)

// ⌘K / Ctrl+K → focus search
const searchRef = ref<HTMLInputElement | null>(null)
onMounted(() => {
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      searchRef.value?.focus()
    }
  })
})

// ─── User initials ────────────────────────────────────────────────────────────

const userInitials = computed(() => {
  const name = props.user?.name ?? props.user?.email ?? ''
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'U'
})
</script>

<template>
  <header class="sticky top-0 z-40 h-14 bg-card/95 backdrop-blur-sm border-b border-card-line flex items-center gap-4 px-6">

    <!-- Left slot (breadcrumb, page title, etc.) -->
    <div v-if="$slots.left" class="flex items-center gap-3 min-w-0 mr-auto">
      <slot name="left" />
    </div>
    <div v-else class="mr-auto" />

    <!-- Global search -->
    <div v-if="showSearch" class="relative hidden sm:block w-72">
      <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg class="size-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <input
        ref="searchRef"
        v-model="searchQuery"
        type="search"
        :placeholder="searchPlaceholder"
        class="w-full h-9 pl-9 pr-12 text-sm bg-surface border border-card-line rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
        @keydown.enter="handleSearch"
      />
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <kbd class="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground bg-muted border border-card-line rounded">
          <span class="text-[9px]">⌘</span>K
        </kbd>
      </div>
    </div>

    <!-- Right slot -->
    <slot name="right" />

    <!-- Notifications -->
    <button
      v-if="showNotifications"
      type="button"
      class="relative size-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
      @click="emit('notification-click')"
    >
      <svg class="size-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span
        v-if="notificationsCount > 0"
        class="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none"
      >{{ notificationsCount > 99 ? '99+' : notificationsCount }}</span>
    </button>

    <!-- User -->
    <div v-if="showUser && user" class="flex items-center gap-2.5 pl-2 border-l border-card-line">
      <div class="size-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 select-none">
        {{ userInitials }}
      </div>
      <div class="hidden md:block min-w-0">
        <p class="text-sm font-semibold text-foreground truncate leading-tight">{{ user.name ?? user.email }}</p>
        <p v-if="user.role" class="text-xs text-muted-foreground truncate leading-tight">{{ user.role }}</p>
      </div>
    </div>

  </header>
</template>
