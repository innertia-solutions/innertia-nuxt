<script setup lang="ts">
import { IconBellOff, IconChecks, IconCheck, IconTrash, IconChevronLeft, IconChevronRight, IconArrowUpRight } from '@tabler/icons-vue'
import { groupByDay, timeAgo, defaultNotificationLink, type HistoryFilter, type NotificationItem } from '../../composables/useNotificationHistory/internal/format'

/*
 * App.NotificationHistory — vista "ver todas" del centro de notificaciones:
 * lista paginada agrupada por día, filtro Todas / No leídas, marcar leída
 * (una o todas), eliminar una y borrar las leídas.
 *
 * Backend: notification center de innertia-laravel (useNotificationHistory).
 * Cada producto monta la página (p. ej. /backoffice/notifications) y puede
 * pasar `resolveLink` para mapear el payload de sus eventos a una ruta.
 *
 *   <App.NotificationHistory :resolve-link="(n) => n.data?.project_id ? `/projects/${n.data.project_id}` : null" />
 */
const props = withDefaults(defineProps<{
  perPage?: number
  /** Ruta destino al abrir una notificación; null = no navega. Default: data.link → data.url. */
  resolveLink?: (n: NotificationItem) => string | null | undefined
}>(), { perPage: 20, resolveLink: undefined })

const emit = defineEmits<{ (e: 'open', n: NotificationItem): void }>()

const filter = ref<HistoryFilter>('all')
const page = ref(1)
watch(filter, () => { page.value = 1 })

const { list, markRead, markAllRead, remove, removeRead } = useNotificationHistory()
const { data, isLoading, isError, refetch } = list(() => ({ filter: filter.value, page: page.value, perPage: props.perPage }))
const { mutateAsync: doMarkRead } = markRead()
const { mutate: doMarkAll, isPending: markingAll } = markAllRead()
const { mutate: doRemove } = remove()
const { mutate: doRemoveRead, isPending: removingRead } = removeRead()
const { confirm } = useModal()

const items = computed<NotificationItem[]>(() => (data.value as any)?.data ?? [])
const unread = computed<number>(() => (data.value as any)?.unread ?? 0)
const total = computed<number>(() => (data.value as any)?.total ?? 0)
const lastPage = computed<number>(() => (data.value as any)?.last_page ?? 1)
const groups = computed(() => groupByDay(items.value))

// Si la página actual quedó vacía (p. ej. tras marcar/borrar), retrocede una.
watch([items, lastPage], () => {
  if (!items.value.length && page.value > 1 && page.value > lastPage.value) page.value = lastPage.value
})

const filterOptions = computed(() => [
  { value: 'all', label: 'Todas' },
  { value: 'unread', label: unread.value ? `No leídas (${unread.value})` : 'No leídas' },
])

const linkOf = (n: NotificationItem) => (props.resolveLink ? props.resolveLink(n) : defaultNotificationLink(n)) ?? null

async function open(n: NotificationItem) {
  emit('open', n)
  if (!n.read_at) { try { await doMarkRead(n.id) } catch { /* noop */ } }
  const link = linkOf(n)
  if (link) navigateTo(link)
}

async function removeOne(n: NotificationItem) {
  if (await confirm({ severity: 'danger', message: '¿Eliminar esta notificación?' })) doRemove(n.id)
}

async function clearRead() {
  if (await confirm({ severity: 'danger', message: '¿Borrar todas las notificaciones leídas? Esta acción no se puede deshacer.' })) doRemoveRead()
}

const initial = (t?: string | null) => (t || '?').trim().charAt(0).toUpperCase()
const fullDate = (iso?: string | null) => iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : ''
</script>

<template>
  <div class="bg-card border border-card-line rounded-card overflow-hidden">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-card-divider">
      <App.SegmentedControl v-model="filter" :options="filterOptions" />
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground-1 hover:bg-muted-hover hover:text-foreground disabled:opacity-50 disabled:pointer-events-none"
          :disabled="!unread || markingAll"
          @click="doMarkAll()"
        >
          <IconChecks class="size-4" /> Marcar todas como leídas
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 disabled:pointer-events-none"
          :disabled="removingRead || (filter === 'all' && total > 0 && unread === total)"
          @click="clearRead"
        >
          <IconTrash class="size-4" /> Borrar leídas
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="p-5 space-y-5">
      <div v-for="i in 5" :key="i" class="flex gap-3 animate-pulse">
        <span class="size-9 rounded-full bg-surface-1 shrink-0" />
        <div class="flex-1 space-y-2"><span class="block h-3 w-1/4 bg-surface-1 rounded" /><span class="block h-3 w-2/3 bg-surface-1 rounded" /></div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="isError" class="py-14 text-center text-sm text-muted-foreground">
      No se pudieron cargar las notificaciones.
      <button type="button" class="ms-1 text-primary hover:underline" @click="refetch()">Reintentar</button>
    </div>

    <!-- Vacío -->
    <div v-else-if="!items.length" class="py-16 flex flex-col items-center text-center text-muted-foreground">
      <IconBellOff class="size-10 mb-3 opacity-30" :stroke-width="1.5" />
      <p class="text-sm font-medium text-foreground">{{ filter === 'unread' ? 'Estás al día' : 'No tienes notificaciones' }}</p>
      <p class="text-sm">{{ filter === 'unread' ? 'No hay notificaciones sin leer.' : 'Aquí verás el historial de avisos del sistema.' }}</p>
    </div>

    <!-- Lista agrupada por día -->
    <div v-else>
      <section v-for="g in groups" :key="g.key">
        <h3 class="px-4 sm:px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-card-divider first-letter:uppercase">{{ g.label }}</h3>
        <ul class="divide-y divide-card-divider">
          <li
            v-for="n in g.items" :key="n.id"
            class="group relative flex gap-x-3 px-4 sm:px-5 py-3.5 cursor-pointer hover:bg-muted-hover transition-colors"
            :class="!n.read_at && 'bg-primary/5'"
            @click="open(n)"
          >
            <div class="relative shrink-0">
              <span class="flex items-center justify-center size-9 rounded-full bg-primary/10 text-primary text-sm font-semibold">{{ initial(n.title) }}</span>
              <span v-if="!n.read_at" class="absolute -top-0.5 -start-0.5 size-2.5 bg-primary rounded-full ring-2 ring-card" />
            </div>
            <div class="grow min-w-0">
              <div class="flex items-baseline gap-2">
                <p class="text-sm text-foreground truncate" :class="!n.read_at ? 'font-semibold' : 'font-medium'">{{ n.title || 'Notificación' }}</p>
                <IconArrowUpRight v-if="linkOf(n)" class="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </div>
              <p v-if="n.body" class="text-sm text-muted-foreground-1 line-clamp-2">{{ n.body }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground" :title="fullDate(n.created_at)">{{ timeAgo(n.created_at) }}</p>
            </div>
            <div class="shrink-0 flex items-start gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
              <button
                v-if="!n.read_at" type="button" title="Marcar como leída" aria-label="Marcar como leída"
                class="size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground-1 hover:bg-card hover:text-foreground"
                @click.stop="doMarkRead(n.id)"
              ><IconCheck class="size-4" /></button>
              <button
                type="button" title="Eliminar" aria-label="Eliminar"
                class="size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground-1 hover:bg-red-500/10 hover:text-red-600"
                @click.stop="removeOne(n)"
              ><IconTrash class="size-4" /></button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Paginación -->
    <div v-if="lastPage > 1" class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-card-divider text-sm text-muted-foreground-1">
      <span>Página {{ page }} de {{ lastPage }} · {{ total }} {{ total === 1 ? 'notificación' : 'notificaciones' }}</span>
      <div class="flex items-center gap-1">
        <button
          type="button" aria-label="Página anterior"
          class="size-8 inline-flex items-center justify-center rounded-lg border border-card-line hover:bg-muted-hover disabled:opacity-50 disabled:pointer-events-none"
          :disabled="page <= 1" @click="page--"
        ><IconChevronLeft class="size-4" /></button>
        <button
          type="button" aria-label="Página siguiente"
          class="size-8 inline-flex items-center justify-center rounded-lg border border-card-line hover:bg-muted-hover disabled:opacity-50 disabled:pointer-events-none"
          :disabled="page >= lastPage" @click="page++"
        ><IconChevronRight class="size-4" /></button>
      </div>
    </div>
  </div>
</template>
