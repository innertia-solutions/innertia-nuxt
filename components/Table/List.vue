<script setup>
import { IconSearch, IconLoader2 } from '@tabler/icons-vue'
import { useInfiniteQuery } from '@tanstack/vue-query'

// Infinite scroll list — fetches next page when sentinel enters viewport
const props = defineProps({
  endpoint: { type: String, required: true },
  name: { type: String, required: true },
  params: { type: Object, default: () => ({}) },
  searchPlaceholder: { type: String, default: 'Buscar...' },
  showSearch: { type: Boolean, default: true },
  perPage: { type: Number, default: 20 },
})

const emit = defineEmits(['row-click'])

const api = useApi()
const search = ref('')
const sentinel = ref(null)

let searchTimeout = null
const debouncedSearch = ref('')
watch(search, (v) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { debouncedSearch.value = v }, 400)
})

const queryKey = computed(() => [props.name, 'infinite', debouncedSearch.value, props.params])

const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } = useInfiniteQuery({
  queryKey,
  queryFn: ({ pageParam = 1 }) =>
    api.post(props.endpoint, {
      search: debouncedSearch.value,
      page: pageParam,
      perPage: props.perPage,
      ...props.params,
    }),
  getNextPageParam: (lastPage) => {
    const meta = lastPage?.meta ?? lastPage
    if (!meta?.current_page || !meta?.last_page) return undefined
    return meta.current_page < meta.last_page ? meta.current_page + 1 : undefined
  },
  initialPageParam: 1,
})

const rows = computed(() => data.value?.pages.flatMap(p => p?.data ?? (Array.isArray(p) ? p : [])) ?? [])

// Intersection observer for auto-load
let observer = null
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasNextPage.value && !isFetchingNextPage.value) {
      fetchNextPage()
    }
  }, { rootMargin: '200px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())

watch(sentinel, (el) => {
  if (el && observer) observer.observe(el)
})

const reload = () => refetch()
defineExpose({ reload, rows })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="showSearch" class="relative">
      <div class="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none">
        <IconSearch class="size-4 text-muted-foreground" stroke="1.5" />
      </div>
      <input
        v-model="search"
        type="text"
        :placeholder="searchPlaceholder"
        class="innertia-field pe-10"
      />
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="space-y-2">
      <div
        v-for="i in 8"
        :key="i"
        class="h-16 bg-surface rounded-card animate-pulse"
      />
    </div>

    <!-- Rows -->
    <div v-else class="space-y-2">
      <div
        v-for="row in rows"
        :key="row.id ?? JSON.stringify(row)"
        class="bg-card border border-card-line rounded-card px-4 py-3 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors cursor-pointer"
        @click="emit('row-click', row)"
      >
        <slot name="item" :row="row">
          <!-- Default: show first few keys -->
          <div class="flex flex-wrap gap-x-6 gap-y-1">
            <div
              v-for="(val, key) in Object.fromEntries(Object.entries(row).slice(0, 4))"
              :key="key"
              class="text-sm"
            >
              <span class="text-muted-foreground text-xs">{{ key }}: </span>
              <span class="text-foreground">{{ val }}</span>
            </div>
          </div>
        </slot>
      </div>

      <div v-if="rows.length === 0" class="text-center py-12 text-muted-foreground text-sm">
        Sin resultados
      </div>
    </div>

    <!-- Sentinel + loader -->
    <div ref="sentinel" class="flex justify-center py-4">
      <div v-if="isFetchingNextPage" class="flex items-center gap-2 text-sm text-slate-400">
        <IconLoader2 class="size-4 animate-spin" stroke="1.5" />
        Cargando más...
      </div>
    </div>
  </div>
</template>
