<script setup>
import { IconSearch, IconLoader2, IconDownload } from '@tabler/icons-vue'
import { useInfiniteQuery } from '@tanstack/vue-query'

/*
 * Table.MasterDetail — lista buscable con scroll infinito (izquierda) + panel de
 * detalle/preview (derecha) con header, acciones, skeleton y contenido. Calca el
 * layout CRM del design system.
 *
 * La lista consume el MISMO endpoint DataTable del recurso (GET con {search,page,perPage,
 * ...params}) → {data, meta{current_page,last_page}}. Sin endpoints /list dedicados: el
 * DataTable::render del backend ya pagina/filtra/exporta.
 * Slots: #action (header lista), #item="{row,active}", #header="{row}", default (detalle), #empty.
 * `loading` (prop) muestra el skeleton del panel de detalle mientras el consumer carga.
 * `selectedId` controla la selección desde fuera (deep-link por URL); si no se pasa,
 * el componente mantiene su propia selección interna (modo no-controlado).
 */
const props = defineProps({
  endpoint: { type: String, required: true },
  name: { type: String, required: true },
  params: { type: Object, default: () => ({}) },
  title: { type: String, default: '' },
  searchPlaceholder: { type: String, default: 'Buscar…' },
  perPage: { type: Number, default: 20 },
  itemTitle: { type: String, default: 'name' },
  itemSubtitle: { type: String, default: 'email' },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: 'Selecciona un elemento para ver su detalle.' },
  selectedId: { type: [String, Number], default: null },
  /** Alto del contenedor (CSS). Ajústalo para que la página quepa sin scroll. */
  height: { type: String, default: 'calc(100dvh - 13rem)' },
  /** Auto-refresco por realtime (se suscribe a los meta.channels del backend). */
  realtime: { type: Boolean, default: true },
  /** Cachea la lista (opt-in, TTL 10min) — misma estrategia que Table.Standard/DataTable. */
  cached: { type: Boolean, default: false },
  /** Muestra el botón "Exportar" (xlsx) en el header de la lista. */
  exportable: { type: Boolean, default: true },
  /** Formato de export (por ahora solo 'xlsx'). */
  exportFormat: { type: String, default: 'xlsx' },
})

const emit = defineEmits(['select'])

const api = useApi()
const search = ref('')
const sentinel = ref(null)
const innerSelected = ref(null)

// Modo controlado (selectedId) o no-controlado (click interno). Comparamos como
// string para tolerar ids uuid vs numéricos.
const activeId = computed(() => props.selectedId ?? innerSelected.value?.id ?? null)
const isActive = (row) => activeId.value != null && String(row?.id) === String(activeId.value)
const hasSelection = computed(() => activeId.value != null)

let searchTimeout = null
const debouncedSearch = ref('')
watch(search, (v) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { debouncedSearch.value = v }, 400)
})

// Export a archivo (xlsx): pega al mismo endpoint DataTable con ?exportType=…
// Va por fetch propio + blob (useApi solo maneja json/text), con los headers de
// auth de los interceptors (Bearer + X-Tenant).
const config = useRuntimeConfig()
const apiBase = config.public.apiBaseUrl || '/api'
const { run: runInterceptors } = useRequestInterceptors()
const exporting = ref(false)

async function downloadExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    const headers = { Accept: 'application/octet-stream' }
    runInterceptors(headers)
    const qs = new URLSearchParams({ exportType: props.exportFormat, search: debouncedSearch.value })
    for (const [k, v] of Object.entries(props.params ?? {})) {
      if (v !== null && v !== undefined) qs.append(k, String(v))
    }
    const res = await fetch(`${apiBase}/${props.endpoint}?${qs.toString()}`, { headers })
    if (!res.ok) throw new Error('export failed: ' + res.status)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.name}.${props.exportFormat}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('[Table.MasterDetail] export error', e)
  } finally {
    exporting.value = false
  }
}

const queryKey = computed(() => [props.name, 'md', debouncedSearch.value, props.params])
const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } = useInfiniteQuery({
  queryKey,
  queryFn: ({ pageParam = 1 }) => api.get(props.endpoint, {
    params: { search: debouncedSearch.value, page: pageParam, perPage: props.perPage, ...props.params },
  }),
  getNextPageParam: (last) => {
    const meta = last?.meta ?? last
    if (!meta?.current_page || !meta?.last_page) return undefined
    return meta.current_page < meta.last_page ? meta.current_page + 1 : undefined
  },
  initialPageParam: 1,
  staleTime: props.cached ? 10 * 60 * 1000 : 0,
  gcTime: props.cached ? 10 * 60 * 1000 : 5 * 60 * 1000,
})
const rows = computed(() => data.value?.pages.flatMap(p => p?.data ?? (Array.isArray(p) ? p : [])) ?? [])

// Realtime: se suscribe a los canales que anuncia el backend en meta.channels
// (entity.{tabla}[.{tenant}]) y refetchea la lista al recibir {canal}.changed.
const rt = props.realtime ? useTableRealtime(() => refetch()) : null
watch(data, () => {
  if (!rt) return
  const pages = data.value?.pages ?? []
  const meta = pages[pages.length - 1]?.meta ?? pages[0]?.meta
  rt.sync(meta?.channels ?? [])
}, { immediate: true })
onBeforeUnmount(() => rt?.teardown())

let observer = null
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasNextPage.value && !isFetchingNextPage.value) fetchNextPage()
  }, { rootMargin: '200px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(sentinel, (el) => { if (el && observer) observer.observe(el) })

const initial = (row) => String(row?.[props.itemTitle] ?? '?').trim().charAt(0).toUpperCase()

function pick(row) {
  innerSelected.value = row
  emit('select', row)
}
</script>

<template>
  <div class="flex rounded-card border border-card-line overflow-hidden bg-card min-h-[360px]" :style="{ height }">
    <!-- ── Lista ── -->
    <aside class="w-80 shrink-0 border-e border-card-line flex flex-col">
      <div v-if="title || $slots.action || exportable" class="p-3 flex items-center justify-between gap-2 border-b border-card-line">
        <h2 class="text-sm font-semibold text-foreground truncate">{{ title }}</h2>
        <div class="flex items-center gap-2 shrink-0">
          <slot name="action" />
          <button v-if="exportable" type="button" @click="downloadExport" :disabled="exporting"
            class="inline-flex items-center gap-1.5 rounded-lg border border-card-line px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-50 transition-colors">
            <IconLoader2 v-if="exporting" class="size-3.5 animate-spin" />
            <IconDownload v-else class="size-3.5" :stroke-width="1.5" />
            Exportar
          </button>
        </div>
      </div>

      <div class="px-3 pt-3 pb-2">
        <div class="relative">
          <div class="absolute inset-y-0 start-0 flex items-center ps-2.5 pointer-events-none">
            <IconSearch class="size-4 text-muted-foreground" :stroke-width="1.5" />
          </div>
          <input v-model="search" type="text" :placeholder="searchPlaceholder"
            class="py-2 px-8 block w-full bg-surface border-transparent text-foreground placeholder:text-muted-foreground rounded-lg text-sm focus:bg-card focus:border-primary focus:ring-primary/30" />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-card-line">
        <!-- Skeleton lista -->
        <div v-if="isLoading" class="p-3 space-y-3">
          <div v-for="i in 8" :key="i" class="flex items-center gap-3 animate-pulse">
            <span class="size-8 rounded-full bg-surface-1 shrink-0" />
            <div class="flex-1 space-y-2"><span class="block h-3 w-2/3 bg-surface-1 rounded" /><span class="block h-2.5 w-1/2 bg-surface-1 rounded" /></div>
          </div>
        </div>

        <template v-else>
          <div v-for="row in rows" :key="row.id ?? JSON.stringify(row)"
            class="relative cursor-pointer before:absolute before:inset-y-0 before:inset-s-0 before:w-[3px] before:rounded-full before:transition-colors"
            :class="isActive(row) ? 'before:bg-primary bg-surface' : 'before:bg-transparent hover:before:bg-card-line'"
            @click="pick(row)">
            <slot name="item" :row="row" :active="isActive(row)">
              <div class="p-3 flex items-center gap-x-3 border-b border-card-line">
                <span class="shrink-0 size-8 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase">{{ initial(row) }}</span>
                <div class="grow min-w-0">
                  <p class="truncate font-medium text-[13px] text-foreground">{{ row[itemTitle] }}</p>
                  <p class="truncate text-xs text-muted-foreground">{{ row[itemSubtitle] }}</p>
                </div>
              </div>
            </slot>
          </div>

          <div v-if="!rows.length" class="text-center py-12 text-muted-foreground text-sm">Sin resultados</div>
          <div ref="sentinel" class="flex justify-center py-4">
            <IconLoader2 v-if="isFetchingNextPage" class="size-4 animate-spin text-muted-foreground" />
          </div>
        </template>
      </div>
    </aside>

    <!-- ── Detalle ── -->
    <section class="grow overflow-y-auto">
      <!-- Vacío -->
      <div v-if="!hasSelection" class="h-full flex flex-col items-center justify-center text-center text-muted-foreground px-6">
        <slot name="empty">
          <IconSearch class="size-10 mb-3 opacity-30" :stroke-width="1.5" />
          <p class="text-sm">{{ emptyText }}</p>
        </slot>
      </div>

      <!-- Skeleton detalle -->
      <div v-else-if="loading" class="p-6 animate-pulse">
        <div class="flex items-center gap-4">
          <span class="size-16 rounded-full bg-surface-1 shrink-0" />
          <div class="flex-1 space-y-2"><span class="block h-5 w-1/3 bg-surface-1 rounded" /><span class="block h-3 w-1/4 bg-surface-1 rounded" /></div>
        </div>
        <div class="mt-8 space-y-3">
          <span v-for="i in 4" :key="i" class="block h-4 bg-surface-1 rounded" :style="{ width: (90 - i * 12) + '%' }" />
        </div>
      </div>

      <!-- Contenido -->
      <div v-else>
        <div v-if="$slots.header" class="p-6 border-b border-card-line">
          <slot name="header" :id="activeId" />
        </div>
        <div class="p-6">
          <slot :id="activeId" />
        </div>
      </div>
    </section>
  </div>
</template>
