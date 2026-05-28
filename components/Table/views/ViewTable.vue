<script setup>
import {
  IconSelector,
  IconChevronUp,
  IconChevronDown,
  IconPin,
} from '@tabler/icons-vue'

const props = defineProps({
  table:                Object,
  loading:              Boolean,
  skeletonRows:         Array,
  lastRowHeight:        Number,
  checkable:            Boolean,
  previewRowId:         { type: [String, Number], default: null },
  isRowClickEnabled:    Boolean,
  search:               String,
  columnFilters:        Array,
  hasFilterableColumns: Boolean,
  pagination:           Object,
  getPinnedStyles:      Function,
  pinnedRowStyle:       Function,
  onHeaderDrop:         Function,
  onAutoSizeColumn:     Function,
})

const emit = defineEmits(['row-click', 'row-keydown'])

// Internal drag state — purely visual, owned by this view
let draggedHeaderId = null
const dragOverHeaderId = ref(null)
const resizeHoverId = ref(null)

const tableBodyEl = ref(null)
defineExpose({ tableBodyEl })

const onHeaderDragStart = (colId) => { draggedHeaderId = colId }
const onHeaderDragOver = (e, colId) => { e.preventDefault(); dragOverHeaderId.value = colId }
const onHeaderDragLeave = () => { dragOverHeaderId.value = null }
const onHeaderDropLocal = (colId) => {
  if (!draggedHeaderId || draggedHeaderId === colId) { draggedHeaderId = null; dragOverHeaderId.value = null; return }
  if (colId === 'select') { draggedHeaderId = null; dragOverHeaderId.value = null; return }
  props.onHeaderDrop?.(draggedHeaderId, colId)
  draggedHeaderId = null
  dragOverHeaderId.value = null
}
</script>

<template>
  <div class="overflow-x-auto relative">
    <table
      class="relative divide-y divide-card-line"
      :style="{ tableLayout: 'fixed', width: table.getTotalSize() + 'px', minWidth: '100%' }"
    >
      <colgroup>
        <col
          v-for="col in [...table.getLeftVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns(), ...table.getRightVisibleLeafColumns()]"
          :key="col.id"
          :style="{ width: col.getSize() + 'px' }"
        >
      </colgroup>
      <thead class="relative z-20 bg-card">
        <template v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
          <!-- Main header row -->
          <tr class="bg-card">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              scope="col"
              :draggable="header.id !== 'select' && resizeHoverId !== header.id && !header.column.getIsPinned()"
              @dragstart="header.id !== 'select' && resizeHoverId !== header.id && !header.column.getIsPinned() && onHeaderDragStart(header.id)"
              @dragover="header.id !== 'select' && onHeaderDragOver($event, header.id)"
              @dragleave="onHeaderDragLeave"
              @drop="header.id !== 'select' && onHeaderDropLocal(header.id)"
              class="relative"
              :class="[
                header.id === 'select' ? 'text-center' : '',
                dragOverHeaderId === header.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : '',
                header.column.getCanSort() ? 'cursor-pointer select-none' : '',
              ]"
              :style="getPinnedStyles(header.column, true)"
              @click="header.column.getCanSort() && header.column.toggleSorting()"
            >
              <!-- Select all checkbox -->
              <template v-if="header.id === 'select'">
                <input
                  type="checkbox"
                  :checked="table.getIsAllRowsSelected()"
                  :indeterminate="table.getIsSomeRowsSelected()"
                  @change="table.getToggleAllRowsSelectedHandler()($event)"
                  class="mx-2 shrink-0 border-card-line rounded-control text-blue-900 focus:ring-0 focus:ring-offset-0 dark:bg-card"
                />
              </template>
              <!-- Regular column header -->
              <template v-else>
                <div
                  class="px-4 py-3 flex items-center gap-x-1 text-xs font-medium w-full overflow-hidden"
                  :class="header.column.getIsPinned() ? 'text-foreground' : 'text-muted-foreground'"
                >
                  <IconPin v-if="header.column.getIsPinned()" class="size-3 shrink-0 text-indigo-400 dark:text-indigo-500" />
                  <span class="truncate">{{ header.column.columnDef.meta?.label ?? header.id }}</span>
                  <span v-if="header.column.getCanSort()">
                    <IconSelector v-if="!header.column.getIsSorted()" class="size-4 opacity-40" />
                    <IconChevronDown v-else-if="header.column.getIsSorted() === 'desc'" class="size-4" />
                    <IconChevronUp v-else class="size-4" />
                  </span>
                </div>
                <!-- Resize handle -->
                <div
                  v-if="header.column.getCanResize()"
                  class="absolute right-0 top-0 h-full w-3 cursor-col-resize group/rz flex items-center justify-center select-none touch-none"
                  @mouseenter="resizeHoverId = header.id"
                  @mouseleave="resizeHoverId = null"
                  @mousedown.stop="header.getResizeHandler()?.($event)"
                  @touchstart.passive.stop="header.getResizeHandler()?.($event)"
                  @dblclick.stop="onAutoSizeColumn?.(header)"
                  @dragstart.stop.prevent
                  @click.stop
                >
                  <div
                    class="h-4 w-px transition-all"
                    :class="header.column.getIsResizing()
                      ? 'bg-indigo-400 dark:bg-indigo-500 !w-0.5'
                      : 'bg-surface-1 group-hover/rz:bg-indigo-300 dark:group-hover/rz:bg-indigo-600 group-hover/rz:w-0.5'"
                  />
                </div>
              </template>
            </th>
          </tr>

          <!-- Column filter row -->
          <tr
            v-if="hasFilterableColumns"
            class="border-b border-card-line bg-muted/50"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="'f-' + header.id"
              :class="[
                header.id === 'select' ? 'w-12' : 'px-3 py-1.5',
              ]"
              :style="getPinnedStyles(header.column, true)"
            >
              <input
                v-if="header.column.getCanFilter()"
                :value="header.column.getFilterValue() ?? ''"
                @input="(e) => header.column.setFilterValue(e.target.value || undefined)"
                :placeholder="`Filtrar ${header.column.columnDef.meta?.label ?? ''}...`"
                class="w-full bg-card border border-card-line rounded-control text-xs text-muted-foreground-1 px-2.5 py-1 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500 outline-none transition-all"
              />
            </th>
          </tr>
        </template>
      </thead>

      <tbody ref="tableBodyEl" class="divide-y divide-card-line">
        <!-- Loading skeleton rows -->
        <tr
          v-if="loading"
          v-for="(_, i) in skeletonRows"
          :key="'sk-' + i"
          class="animate-pulse bg-card"
        >
          <td
            v-for="header in (table.getHeaderGroups()[0]?.headers ?? [])"
            :key="'skc-' + header.id"
            :class="[
              header.id === 'select' ? 'text-center w-12' : 'px-4 overflow-hidden',
            ]"
            :style="{ height: lastRowHeight + 'px', ...getPinnedStyles(header.column) }"
          >
            <div v-if="header.id === 'select'" class="w-4 h-4 bg-surface-1 rounded mx-auto"></div>
            <div v-else class="h-4 w-[50%] rounded bg-surface-1"></div>
          </td>
        </tr>

        <!-- Loading filler rows -->
        <tr
          v-if="loading && skeletonRows.length < pagination.pageSize"
          v-for="i in (pagination.pageSize - skeletonRows.length)"
          :key="'lf-' + i"
          class="bg-card"
        >
          <td
            v-for="header in (table.getHeaderGroups()[0]?.headers ?? [])"
            :key="'lfc-' + header.id"
            :style="{ height: lastRowHeight + 'px', ...getPinnedStyles(header.column) }"
          />
        </tr>

        <!-- Empty filler rows -->
        <tr
          v-if="!loading && table.getRowModel().rows.length === 0"
          v-for="i in pagination.pageSize"
          :key="'esk-' + i"
          class="bg-card"
        >
          <td
            v-for="header in (table.getHeaderGroups()[0]?.headers ?? [])"
            :key="'eskc-' + header.id"
            :style="{ height: lastRowHeight + 'px', ...getPinnedStyles(header.column) }"
          />
        </tr>

        <!-- Data rows -->
        <tr
          v-else
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          data-row-type="data"
          @click="(e) => emit('row-click', row, e)"
          @keydown="(e) => emit('row-keydown', row, e)"
          :tabindex="isRowClickEnabled ? 0 : undefined"
          class="bg-card hover:bg-layer-hover transition-colors"
          :class="{
            'cursor-pointer': isRowClickEnabled,
            'bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-indigo-50/60': row.getIsSelected(),
            '!bg-indigo-50 dark:!bg-indigo-900/20 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-700': previewRowId && row.original.id === previewRowId,
          }"
          :style="pinnedRowStyle(row)"
        >
          <td
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            :data-col-id="cell.column.id"
            :class="[
              cell.column.id === 'select'
                ? 'text-center w-12 overflow-hidden'
                : 'px-4 py-3 text-sm text-muted-foreground-1 overflow-hidden',
              cell.column.id !== 'select' ? cell.column.columnDef.meta?.class ?? '' : '',
            ]"
            :style="getPinnedStyles(cell.column)"
          >
            <!-- Select checkbox -->
            <template v-if="cell.column.id === 'select'">
              <div @click.stop>
                <input
                  type="checkbox"
                  :checked="row.getIsSelected()"
                  :disabled="!row.getCanSelect()"
                  @change="row.getToggleSelectedHandler()($event)"
                  class="rounded border-card-line focus:ring-0 focus:ring-offset-0 dark:bg-card"
                />
              </div>
            </template>
            <!-- Data cell with slot -->
            <template v-else>
              <slot :name="cell.column.id" :row="row.original" :value="cell.getValue()">
                {{ cell.getValue() }}
              </slot>
            </template>
          </td>
        </tr>

        <!-- Filler rows: pad table to full page height -->
        <tr
          v-if="!loading && table.getRowModel().rows.length > 0 && table.getRowModel().rows.length < pagination.pageSize"
          v-for="i in (pagination.pageSize - table.getRowModel().rows.length)"
          :key="'fill-' + i"
          class="bg-card"
        >
          <td
            v-for="header in (table.getHeaderGroups()[0]?.headers ?? [])"
            :key="'fillc-' + header.id"
            :style="{ height: lastRowHeight + 'px', ...getPinnedStyles(header.column) }"
          />
        </tr>
      </tbody>
    </table>

    <!-- Empty state overlays -->
    <div
      v-if="!loading && table.getRowModel().rows.length === 0 && !search && !columnFilters?.length"
      class="absolute inset-0 z-10 pointer-events-none flex items-center justify-center backdrop-blur-sm bg-card/60 rounded-card"
    >
      <slot name="empty">
        <p class="text-muted-foreground text-lg font-medium italic">No hay registros</p>
      </slot>
    </div>

    <div
      v-if="!loading && table.getRowModel().rows.length === 0 && (search || columnFilters?.length)"
      class="absolute inset-0 z-10 pointer-events-none flex items-center justify-center backdrop-blur-sm bg-card/60 rounded-card"
    >
      <slot name="empty-search">
        <p class="text-muted-foreground text-lg font-medium italic">No hay registros en la búsqueda</p>
      </slot>
    </div>
  </div>
</template>

<style scoped>
tbody tr {
  --row-bg: var(--card, #fff);
}
tbody tr:hover {
  --row-bg: var(--layer-hover, #f8fafc);
}
</style>
