<script setup>
import {
  ref,
  onMounted,
  watch,
  computed,
  nextTick,
  onBeforeUnmount,
  getCurrentInstance,
} from "vue";

import {
  IconArrowsSort,
  IconSortAscendingSmallBig,
  IconSortDescendingSmallBig,
  IconReload,
  IconBolt,
} from "@tabler/icons-vue";

const props = defineProps({
  endpoint: { type: String, required: true },
  params: { type: Object, default: () => ({}) },
  columns: { type: Array, required: true }, // [{ key, label, sortable, class }]
  checkable: { type: Boolean, default: false },
  search: { type: String, default: "" },
  showReloadButton: { type: Boolean, default: true },
  cached: { type: Boolean, default: false },
  name: { type: String, required: true },
  viewMode: { type: String, default: "table" }, // 'table' | 'grid'
  gridClass: { type: String, default: "grid grid-cols-2 lg:grid-cols-3 gap-4" },
  clickRowToOpen: { type: Boolean, default: false },
});

const emit = defineEmits(["update:search", "row-click", "loaded"]);
const instance = getCurrentInstance();

const api = useApi();
const toast = useToast();
const data = ref([]);
const meta = ref({});
const loading = ref(false);
const page = ref(1);
const perPage = ref(10);
const isCustomPerPage = ref(false);
const selectedRows = ref([]);
const isDataFromCache = ref(false);
const lastDataLength = ref(10);
const lastRowHeight = ref(48);
const tableBodyRef = ref(null);
const skeletonRows = computed(() => Array.from({ length: lastDataLength.value }));
const hasRecords = computed(() => data.value.length > 0);
const selectedCount = computed(() => selectedRows.value.length);
const isGridView = computed(() => props.viewMode === "grid");

const sortColumns = ref([]);
let isRestoring = false;
let searchWatcher = null;

const initializeSortColumns = () => {
  if (props.params.sort && typeof props.params.sort === "string") {
    const parts = props.params.sort.split(":");
    if (parts.length === 2) {
      sortColumns.value = [{ column: parts[0], direction: parts[1] }];
    }
  }
};

// CACHE
const generateCacheKey = () => {
  if (!props.cached || !props.name) return null;
  return `table_cache_${props.name}`;
};

const saveToCache = () => {
  if (!props.cached) return;
  const cacheKey = generateCacheKey();
  if (!cacheKey || !data.value?.length) return;
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({
      data: data.value,
      meta: meta.value,
      page: page.value,
      selectedRows: selectedRows.value,
      sortColumns: sortColumns.value,
      perPage: perPage.value,
      isCustomPerPage: isCustomPerPage.value,
      search: props.search,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn("[DataTable] Error saving cache:", e);
  }
};

const loadFromCache = () => {
  if (!props.cached) return null;
  const cacheKey = generateCacheKey();
  if (!cacheKey) return null;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (!cached) return null;
    const cacheData = JSON.parse(cached);
    if (Date.now() - cacheData.timestamp > 10 * 60 * 1000) {
      sessionStorage.removeItem(cacheKey);
      return null;
    }
    if (cacheData.search !== props.search) return null;
    return cacheData;
  } catch (e) {
    console.warn("[DataTable] Error loading cache:", e);
    return null;
  }
};

const clearCache = () => {
  const cacheKey = generateCacheKey();
  if (cacheKey) sessionStorage.removeItem(cacheKey);
};

const buildRequestParams = () => {
  const { sort, ...otherParams } = props.params;
  return {
    search: props.search,
    page: page.value,
    perPage: perPage.value,
    ...otherParams,
    sortColumns: sortColumns.value
      .filter((col) => col.direction !== null)
      .map(({ column, direction }) => ({ column, direction })),
  };
};

const fetchData = async () => {
  if (data.value.length > 0) {
    lastDataLength.value = data.value.length;
    if (tableBodyRef.value?.children[0]) {
      const rowHeight = tableBodyRef.value.children[0].getBoundingClientRect().height;
      if (rowHeight > 0) lastRowHeight.value = rowHeight;
    }
  } else if (!props.search && !Object.keys(props.params).length && page.value === 1) {
    lastDataLength.value = 10;
    lastRowHeight.value = 48;
  }

  data.value = [];
  loading.value = true;
  isDataFromCache.value = false;

  try {
    const res = await api.post(props.endpoint, buildRequestParams());

    if (res) {
      data.value = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);

      if (res.meta) {
        meta.value = res.meta;
      } else if (res.current_page !== undefined) {
        meta.value = {
          current_page: res.current_page,
          last_page: res.last_page,
          per_page: res.per_page,
          total: res.total,
          from: res.from,
          to: res.to,
        };
      } else {
        meta.value = {
          current_page: 1,
          last_page: 1,
          per_page: data.value.length,
          total: data.value.length,
          from: 1,
          to: data.value.length,
        };
      }

      if (props.cached) saveToCache();
      emit("loaded", res);
    }
  } catch (e) {
    console.error("[DataTable] Fetch error:", e);
  } finally {
    loading.value = false;
  }
};

const loadFromCacheOnMount = async () => {
  if (!props.cached) return false;
  const cached = loadFromCache();
  if (!cached) return false;

  stopWatching();
  stopSearchWatcher();

  data.value = cached.data;
  meta.value = cached.meta;
  page.value = cached.page;
  perPage.value = cached.perPage || 10;
  isCustomPerPage.value = cached.isCustomPerPage || false;
  selectedRows.value = cached.selectedRows;
  sortColumns.value = cached.sortColumns;
  lastDataLength.value = cached.data.length;
  isDataFromCache.value = true;

  if (cached.search !== props.search) {
    emit("update:search", cached.search);
  }

  await nextTick();
  startWatching();
  startSearchWatcher();
  return true;
};

let searchDebounceTimeout = null;

const startSearchWatcher = () => {
  if (searchWatcher) return;
  searchWatcher = watch(
    () => props.search,
    (newSearch, oldSearch) => {
      if (newSearch === oldSearch) return;
      if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        page.value = 1;
        fetchData();
      }, 500);
    }
  );
};

const stopSearchWatcher = () => {
  if (searchWatcher) { searchWatcher(); searchWatcher = null; }
};

let pageWatcher = null;

const startWatching = () => {
  if (pageWatcher) return;
  pageWatcher = watch([page, sortColumns], () => fetchData(), { deep: true });
};

const stopWatching = () => {
  if (pageWatcher) { pageWatcher(); pageWatcher = null; }
};

onMounted(async () => {
  initializeSortColumns();
  startWatching();
  startSearchWatcher();
  try {
    const loadedFromCache = await loadFromCacheOnMount();
    if (!loadedFromCache) await fetchData();
  } catch (e) {
    console.error("[DataTable] Error during mount:", e);
  }
});

onBeforeUnmount(() => {
  if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
  if (props.cached && data.value.length > 0) saveToCache();
  stopWatching();
  stopSearchWatcher();
});

watch(perPage, () => { page.value = 1; fetchData(); });

watch(() => props.params, () => { page.value = 1; fetchData(); }, { deep: true });

// ROW SELECTION
const toggleSelectAll = () => {
  const allSelected = isAllVisibleSelected.value;
  selectedRows.value = allSelected ? [] : [...data.value];
  if (props.cached && data.value.length > 0) nextTick(() => saveToCache());
};

const toggleRow = (row) => {
  const exists = selectedRows.value.find((r) => r.id === row.id);
  if (exists) {
    selectedRows.value = selectedRows.value.filter((r) => r.id !== row.id);
  } else {
    selectedRows.value.push(row);
  }
  if (props.cached && data.value.length > 0) nextTick(() => saveToCache());
};

const isRowSelected = (row) => selectedRows.value.some((r) => r.id === row.id);

const isAllVisibleSelected = computed(
  () => data.value.length && data.value.every((row) => isRowSelected(row))
);

const getSelectedRows = () => {
  const allSelected = isAllVisibleSelected.value && selectedRows.value.length === data.value.length;
  return allSelected
    ? { meta: { all: true }, rows: [] }
    : { meta: { all: false }, rows: [...selectedRows.value] };
};

// EXPORT
const exportTable = async (format, exportPagination, exportFilteredRows) => {
  const { download } = useDownload();
  const id = crypto.randomUUID();
  toast.show({
    id,
    type: "process",
    title: "Descargando archivo...",
    progress: 0,
    progressLabel: "Iniciando descarga",
    message: "",
    position: "top-right",
  });

  const exportType = ["csv", "xlsx", "pdf", "json"];
  const params = {
    ...buildRequestParams(),
    exportType: exportType.includes(format) ? format : "csv",
    exportPagination,
    exportFilteredRows,
  };

  try {
    const { blob, headers } = await download(props.endpoint, params, {
      method: "POST",
      onProgress: (percent) => {
        toast.update(id, { progress: percent, progressLabel: `Descargando... ${percent}%` });
      },
    });

    let fileName = "export." + format;
    const contentDisposition = headers["content-disposition"];
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
      if (fileNameMatch?.[1]) fileName = fileNameMatch[1];
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.update(id, { progress: 100, progressLabel: "¡Descarga completada!", message: "El archivo se descargó correctamente." });
    setTimeout(() => toast.remove(id), 2000);
  } catch (e) {
    toast.update(id, { progressLabel: "Error en la descarga", message: e.message, severity: "danger" });
    setTimeout(() => toast.remove(id), 3000);
  }
};

defineExpose({
  getSelectedRows,
  hasRecords,
  selectedCount,
  loading,
  exportTable,
  reload: () => { clearCache(); fetchData(); },
  clearCache,
});

// PAGINATION
const goToNextPage = () => { if (page.value < meta.value.last_page) page.value++; };
const goToPreviousPage = () => { if (page.value > 1) page.value--; };

const handlePerPageChange = (val) => {
  if (val === "custom") { isCustomPerPage.value = true; return; }
  perPage.value = parseInt(val);
};

const resetPerPage = () => {
  isCustomPerPage.value = false;
  if (![10, 25, 50, 100].includes(perPage.value)) perPage.value = 10;
};

// SORTING
const toggleSort = (col) => {
  if (!col.sortable) return;
  const existing = sortColumns.value.find((s) => s.column === col.key);
  if (!existing) {
    sortColumns.value.push({ column: col.key, direction: "desc" });
  } else if (existing.direction === "desc") {
    existing.direction = "asc";
  } else {
    sortColumns.value = sortColumns.value.filter((s) => s.column !== col.key);
  }
};

const getSortDirection = (colKey) =>
  sortColumns.value.find((s) => s.column === colKey)?.direction ?? null;

// ROW CLICK
const interactiveRowClickSelector = [
  "a", "button", "input", "select", "textarea", "label", "summary",
  "[role='button']", "[role='link']", "[contenteditable='true']",
  "[data-row-click-ignore]", "[data-no-row-click]", ".hs-dropdown", ".dropdown",
].join(",");

const hasRowClickListener = computed(() => !!instance?.vnode?.props?.onRowClick);
const isRowClickEnabled = computed(() => props.clickRowToOpen || hasRowClickListener.value);

const shouldIgnoreRowClick = (event) => {
  const target = event?.target;
  if (!(target instanceof Element)) return false;
  const interactiveTarget = target.closest(interactiveRowClickSelector);
  return !!interactiveTarget && event.currentTarget?.contains(interactiveTarget);
};

const handleRowClick = (row, event) => {
  if (!isRowClickEnabled.value || shouldIgnoreRowClick(event)) return;
  emit("row-click", row, event);
};

const handleRowKeydown = (row, event) => {
  if (!isRowClickEnabled.value || shouldIgnoreRowClick(event)) return;
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  handleRowClick(row, event);
};
</script>

<template>
  <div class="relative">
    <!-- Table view -->
    <div v-if="!isGridView" class="overflow-x-auto relative">
      <table class="relative min-w-full divide-y divide-card-line">
        <thead class="relative z-20 bg-card">
          <tr
            class="divide-x divide-card-line"
            :class="{ 'border-t border-gray-200': loading || data.length > 0 }"
          >
            <th v-if="checkable" class="text-center w-12">
              <input
                type="checkbox"
                :checked="isAllVisibleSelected"
                @change="toggleSelectAll"
                class="mx-2 shrink-0 border-gray-300 rounded-sm text-blue-900 focus:ring-blue-900 dark:bg-card border-card-line"
              />
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :class="col.class || 'min-w-72'"
              @click="toggleSort(col)"
            >
              <div class="hs-dropdown relative inline-flex w-full cursor-pointer">
                <button class="px-6 py-3 text-start w-full flex items-center gap-x-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {{ col.label }}
                  <span v-if="col.sortable">
                    <IconArrowsSort v-if="getSortDirection(col.key) === null" class="size-4" />
                    <IconSortDescendingSmallBig v-if="getSortDirection(col.key) === 'desc'" class="size-5" />
                    <IconSortAscendingSmallBig v-if="getSortDirection(col.key) === 'asc'" class="size-5" />
                  </span>
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody ref="tableBodyRef" class="divide-y divide-card-line">
          <!-- Loading skeleton -->
          <tr
            v-if="loading"
            v-for="(_, index) in skeletonRows"
            :key="'skeleton-' + index"
            class="animate-pulse divide-x divide-card-line bg-card"
          >
            <td v-if="checkable" class="text-center w-12" :style="{ height: lastRowHeight + 'px' }">
              <div class="w-4 h-4 bg-surface-1 rounded mx-auto"></div>
            </td>
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-6"
              :class="col.class || ''"
              :style="{ height: lastRowHeight + 'px' }"
            >
              <div class="h-4 w-[50%] rounded bg-surface-1"></div>
            </td>
          </tr>

          <!-- Empty skeleton (no data, no search) -->
          <tr
            v-if="!loading && data.length === 0"
            v-for="(_, index) in skeletonRows"
            :key="'empty-skeleton-' + index"
            class="divide-x divide-card-line bg-card"
          >
            <td v-if="checkable" class="text-center w-12" :style="{ height: lastRowHeight + 'px' }">
              <div class="w-4 h-4 bg-surface-1 rounded mx-auto"></div>
            </td>
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-6"
              :class="col.class || ''"
              :style="{ height: lastRowHeight + 'px' }"
            >
              <div class="h-4 w-[50%] rounded bg-surface"></div>
            </td>
          </tr>

          <!-- Data rows -->
          <tr
            v-else
            v-for="row in data"
            :key="row.id"
            @click="(event) => handleRowClick(row, event)"
            @keydown="(event) => handleRowKeydown(row, event)"
            :tabindex="isRowClickEnabled ? 0 : undefined"
            class="divide-x divide-card-line bg-card hover:bg-muted"
            :class="{ 'cursor-pointer': isRowClickEnabled }"
          >
            <td v-if="checkable" class="text-center w-12" @click.stop>
              <input
                type="checkbox"
                :checked="isRowSelected(row)"
                @change="() => toggleRow(row)"
                class="rounded border-card-line dark:bg-card"
              />
            </td>
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-6 py-3 relative group text-sm text-muted-foreground-1"
              :class="col.class || ''"
            >
              <slot :name="col.key" :row="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty overlays -->
      <div
        v-if="!loading && data.length === 0 && !search"
        class="absolute inset-0 z-10 pointer-events-none flex items-center justify-center backdrop-blur-sm bg-card/60 transition-all rounded-xl"
      >
        <slot name="empty">
          <p class="text-muted-foreground text-lg font-medium italic">No hay registros</p>
        </slot>
      </div>

      <div
        v-if="!loading && data.length === 0 && search"
        class="absolute inset-0 z-10 pointer-events-none flex items-center justify-center backdrop-blur-sm bg-card/60 transition-all rounded-xl"
      >
        <slot name="empty-search">
          <p class="text-muted-foreground text-lg font-medium italic">No hay registros en la búsqueda</p>
        </slot>
      </div>
    </div>

    <!-- Grid view -->
    <div v-else class="relative">
      <!-- Grid loading skeleton -->
      <div v-if="loading" :class="gridClass">
        <div v-for="(_, index) in skeletonRows" :key="'grid-skeleton-' + index" class="animate-pulse">
          <slot name="grid-skeleton">
            <div class="bg-card rounded-lg border border-card-line p-4">
              <div class="space-y-3">
                <div class="h-4 bg-surface-1 rounded w-3/4"></div>
                <div class="h-4 bg-surface-1 rounded w-1/2"></div>
                <div class="h-6 bg-surface-1 rounded w-1/4"></div>
              </div>
            </div>
          </slot>
        </div>
      </div>

      <!-- Grid data -->
      <div v-else-if="data.length > 0" :class="gridClass">
        <slot
          name="grid-item"
          v-for="row in data"
          :key="row.id"
          :row="row"
          :isSelected="isRowSelected(row)"
          :checkable="checkable"
          :toggleRow="() => toggleRow(row)"
        >
          <div class="bg-card rounded-lg border border-card-line p-4 hover:shadow-md transition-shadow relative">
            <div v-if="checkable" class="absolute top-2 left-2 z-10">
              <input
                type="checkbox"
                :checked="isRowSelected(row)"
                @change="() => toggleRow(row)"
                class="rounded border-card-line dark:bg-card"
              />
            </div>
            <div class="space-y-2" :class="{ 'pt-6': checkable }">
              <div v-for="col in columns" :key="col.key" class="flex justify-between">
                <span class="text-sm text-muted-foreground">{{ col.label }}:</span>
                <span class="text-sm text-foreground">
                  <slot :name="col.key" :row="row" :value="row[col.key]">{{ row[col.key] }}</slot>
                </span>
              </div>
            </div>
          </div>
        </slot>
      </div>

      <!-- Grid empty state -->
      <div v-else class="flex items-center justify-center py-12">
        <slot v-if="!search" name="empty">
          <p class="text-muted-foreground text-lg">No hay registros</p>
        </slot>
        <slot v-else name="empty-search">
          <p class="text-muted-foreground text-lg">No hay registros en la búsqueda</p>
        </slot>
      </div>
    </div>

    <!-- Pagination & controls -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-y-4 sm:gap-y-0 mt-4 px-6 pb-6">
      <!-- Left: info & reload -->
      <div class="flex items-center justify-start gap-x-4">
        <div v-if="showReloadButton" class="flex items-center justify-start gap-x-2">
          <IconReload
            v-if="!loading"
            class="size-4 cursor-pointer text-muted-foreground hover:text-muted-foreground-1 transition-colors"
            @click="() => { clearCache(); isDataFromCache.value = false; fetchData(); }"
          />
          <div v-if="loading">
            <svg class="animate-spin size-4 text-muted-foreground-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" opacity=".25" />
              <path d="M22 12a10 10 0 0 1-10 10" />
            </svg>
          </div>
        </div>

        <p class="text-sm text-foreground font-medium">{{ meta.total }} registros</p>

        <div v-if="isDataFromCache && cached" class="group relative flex items-center">
          <div class="flex items-center gap-x-1.5 py-1 px-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg cursor-help transition-colors hover:bg-emerald-500/20">
            <IconBolt class="size-3.5 fill-current" />
            <span class="text-[10px] font-bold uppercase tracking-wider">Instant</span>
          </div>
          <div class="absolute bottom-full mb-2 left-0 hidden group-hover:block w-48 p-2.5 bg-slate-900 text-white text-[11px] leading-relaxed rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in duration-200">
            <div class="font-bold mb-1 flex items-center gap-x-1.5 text-emerald-400">
              <IconBolt class="size-3" />
              Datos en Caché
            </div>
            Los datos se cargaron instantáneamente desde la memoria local. Actualice la tabla para sincronizar con el servidor.
            <div class="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-900"></div>
          </div>
        </div>
      </div>

      <!-- Right: per-page & pagination -->
      <div class="flex items-center gap-x-8">
        <div class="flex items-center gap-x-2">
          <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Filas:</label>
          <select
            v-if="!isCustomPerPage"
            :value="perPage"
            @change="(e) => handlePerPageChange(e.target.value)"
            class="bg-surface border-none text-[11px] font-bold text-muted-foreground-1 rounded-lg focus:ring-0 cursor-pointer py-1 pl-2 pr-8"
          >
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option value="custom">Otro...</option>
          </select>
          <div v-else class="flex items-center gap-x-1">
            <input
              type="number"
              v-model.number="perPage"
              min="1"
              max="500"
              class="w-14 bg-surface border-none text-[11px] font-bold text-muted-foreground-1 rounded-lg focus:ring-2 focus:ring-indigo-500/20 py-1 px-2"
              @blur="perPage = perPage || 10"
            />
            <button @click="resetPerPage" class="text-[10px] text-indigo-500 font-bold hover:underline">Volver</button>
          </div>
        </div>

        <nav class="flex justify-end items-center gap-x-1" aria-label="Pagination">
          <button
            type="button"
            class="size-8 flex items-center justify-center rounded-lg text-foreground hover:bg-muted-hover disabled:opacity-30"
            :disabled="page <= 1"
            @click="goToPreviousPage"
          >
            <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div class="flex items-center gap-x-1 mx-2">
            <span class="size-8 flex items-center justify-center text-xs font-bold rounded-lg bg-surface text-foreground">{{ meta.current_page }}</span>
            <span class="text-[10px] font-bold text-muted-foreground uppercase mx-1">de</span>
            <span class="text-[10px] font-bold text-muted-foreground">{{ meta.last_page }}</span>
          </div>
          <button
            type="button"
            class="size-8 flex items-center justify-center rounded-lg text-foreground hover:bg-muted-hover disabled:opacity-30"
            :disabled="page >= meta.last_page"
            @click="goToNextPage"
          >
            <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>
