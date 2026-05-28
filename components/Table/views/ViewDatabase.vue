<script setup>
import { IconLoader2, IconX } from '@tabler/icons-vue'

const props = defineProps({
  table:         Object,
  loading:       Boolean,
  skeletonRows:  Array,
  lastRowHeight: Number,
  checkable:     Boolean,
  editingCell:   { type: Object, default: null },   // { rowId, colKey } | null
  editingValue:  { type: String, default: '' },
  savingCell:    { type: Object, default: null },   // { rowId, colKey } | null
  cellError:     { type: Object, default: null },   // { rowId, colKey, message } | null
})

const emit = defineEmits(['row-click', 'start-edit', 'save-edit', 'cancel-edit', 'editing-value-change'])

const isCellEditing = (rowId, colKey) =>
  props.editingCell?.rowId === rowId && props.editingCell?.colKey === colKey

const isCellSaving = (rowId, colKey) =>
  props.savingCell?.rowId === rowId && props.savingCell?.colKey === colKey

const isCellError = (rowId, colKey) =>
  props.cellError?.rowId === rowId && props.cellError?.colKey === colKey

const getVisibleDataCols = (row) =>
  row.getVisibleCells().filter(c => c.column.id !== 'select')

const isEditable = (col) => col.columnDef.meta?.editable === true

// Tab key: save current cell and move to next editable cell
const handleTabKey = async (e, row, col) => {
  e.preventDefault()
  emit('save-edit', row, col)

  // Find next editable cell
  await nextTick()
  const rows = props.table.getRowModel().rows
  const rowIdx = rows.findIndex(r => r.id === row.id)
  const cols = getVisibleDataCols(row)
  const colIdx = cols.findIndex(c => c.column.id === col.column.id)

  // Try next cells in the same row
  for (let ci = colIdx + 1; ci < cols.length; ci++) {
    if (isEditable(cols[ci].column)) {
      const el = document.querySelector(`[data-cell-editable][data-row-idx="${rowIdx}"][data-col-idx="${ci}"]`)
      if (el) { el.focus(); return }
    }
  }

  // Try first editable cell in next row
  for (let ri = rowIdx + 1; ri < rows.length; ri++) {
    const nextRowCols = getVisibleDataCols(rows[ri])
    for (let ci = 0; ci < nextRowCols.length; ci++) {
      if (isEditable(nextRowCols[ci].column)) {
        const el = document.querySelector(`[data-cell-editable][data-row-idx="${ri}"][data-col-idx="${ci}"]`)
        if (el) { el.focus(); return }
      }
    }
  }
}
</script>

<template>
  <div class="overflow-x-auto">
    <table
      class="w-full divide-y divide-card-line"
      :style="{ tableLayout: 'auto', minWidth: '100%' }"
    >
      <thead class="bg-surface">
        <tr>
          <th
            v-if="checkable"
            scope="col"
            class="text-center py-1.5 px-2.5 border-b border-card-line"
            style="width: 36px"
          >
            <input
              type="checkbox"
              :checked="table.getIsAllRowsSelected()"
              :indeterminate="table.getIsSomeRowsSelected()"
              @change="table.getToggleAllRowsSelectedHandler()($event)"
              class="shrink-0 border-card-line rounded-control text-blue-900 focus:ring-0 focus:ring-offset-0 dark:bg-card"
            />
          </th>
          <th
            v-for="header in table.getHeaderGroups()[0]?.headers.filter(h => h.id !== 'select') ?? []"
            :key="header.id"
            scope="col"
            class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5 px-2.5 border-b border-card-line bg-surface text-left whitespace-nowrap"
          >
            {{ header.column.columnDef.meta?.label ?? header.id }}
          </th>
        </tr>
      </thead>

      <tbody class="divide-y divide-card-line/50">
        <!-- Loading skeleton -->
        <tr
          v-if="loading"
          v-for="(_, i) in skeletonRows"
          :key="'dbsk-' + i"
          class="animate-pulse bg-card"
        >
          <td
            v-if="checkable"
            class="py-2 px-2.5"
          >
            <div class="w-3 h-3 bg-surface-1 rounded mx-auto"></div>
          </td>
          <td
            v-for="header in table.getHeaderGroups()[0]?.headers.filter(h => h.id !== 'select') ?? []"
            :key="'dbskc-' + header.id"
            class="py-2 px-2.5"
          >
            <div class="h-3 w-[60%] rounded bg-surface-1"></div>
          </td>
        </tr>

        <!-- Empty state rows -->
        <tr
          v-if="!loading && table.getRowModel().rows.length === 0"
          v-for="i in (table.getState?.().pagination?.pageSize ?? 10)"
          :key="'dbesk-' + i"
          class="bg-card"
        >
          <td
            v-if="checkable"
            class="py-2"
          />
          <td
            v-for="header in table.getHeaderGroups()[0]?.headers.filter(h => h.id !== 'select') ?? []"
            :key="'dbeskc-' + header.id"
            class="py-2"
          />
        </tr>

        <!-- Data rows -->
        <tr
          v-else
          v-for="(row, rowIdx) in table.getRowModel().rows"
          :key="row.id"
          class="hover:bg-layer-hover transition-colors border-b border-card-line/50"
          :class="{
            'bg-indigo-50/40 dark:bg-indigo-900/10': row.getIsSelected(),
          }"
          @click="emit('row-click', row, $event)"
        >
          <!-- Checkbox cell -->
          <td
            v-if="checkable"
            class="text-center py-1.5 px-2.5"
            style="width: 36px"
            @click.stop
          >
            <input
              type="checkbox"
              :checked="row.getIsSelected()"
              :disabled="!row.getCanSelect()"
              @change="row.getToggleSelectedHandler()($event)"
              class="rounded border-card-line focus:ring-0 focus:ring-offset-0 dark:bg-card"
            />
          </td>

          <!-- Data cells -->
          <td
            v-for="(cell, colIdx) in getVisibleDataCols(row)"
            :key="cell.id"
            class="py-2 px-2.5 text-xs text-foreground relative group/cell overflow-hidden"
            :class="cell.column.columnDef.meta?.class ?? ''"
            :data-cell-editable="isEditable(cell.column) || undefined"
            :data-row-idx="rowIdx"
            :data-col-idx="colIdx"
            :tabindex="isEditable(cell.column) && !isCellEditing(row.id, cell.column.id) ? 0 : undefined"
            @click.stop="isEditable(cell.column) && !isCellEditing(row.id, cell.column.id) && emit('start-edit', row, cell)"
            @keydown.enter.prevent="isEditable(cell.column) && !isCellEditing(row.id, cell.column.id) && emit('start-edit', row, cell)"
          >
            <!-- Editing state — absolute overlay so it never changes the row height -->
            <template v-if="isCellEditing(row.id, cell.column.id)">
              <div class="absolute inset-0 z-10 ring-1 ring-inset ring-indigo-400 bg-card">
                <input
                  :value="editingValue"
                  @input="emit('editing-value-change', $event.target.value)"
                  @keydown.enter.prevent="emit('save-edit', row, cell)"
                  @keydown.escape.prevent="emit('cancel-edit')"
                  @keydown.tab="handleTabKey($event, row, cell)"
                  @click.stop
                  autofocus
                  class="w-full h-full px-2.5 text-xs text-foreground bg-transparent outline-none"
                />
              </div>
            </template>

            <!-- Saving state -->
            <template v-else-if="isCellSaving(row.id, cell.column.id)">
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <IconLoader2 class="size-3 animate-spin shrink-0 text-indigo-400" />
                <span class="truncate">{{ cell.getValue() }}</span>
              </div>
            </template>

            <!-- Error state -->
            <template v-else-if="isCellError(row.id, cell.column.id)">
              <div class="flex items-center gap-1 text-red-500" :title="cellError?.message">
                <IconX class="size-3 shrink-0" />
                <span class="truncate text-foreground">{{ cell.getValue() }}</span>
              </div>
            </template>

            <!-- Normal display -->
            <template v-else>
              <div class="flex items-center gap-1">
                <span class="truncate flex-1">
                  <slot :name="cell.column.id" :row="row.original" :value="cell.getValue()">
                    {{ cell.getValue() }}
                  </slot>
                </span>
                <!-- Pencil indicator for editable cells -->
                <svg
                  v-if="isEditable(cell.column)"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  class="size-2.5 shrink-0 text-muted-foreground opacity-0 group-hover/cell:opacity-60 transition-opacity"
                >
                  <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.76 9.768a1.75 1.75 0 0 0-.455.88l-.5 2.5a.75.75 0 0 0 .875.876l2.5-.5a1.75 1.75 0 0 0 .88-.455l7.255-7.254a1.75 1.75 0 0 0 0-2.474ZM12.72 7.54l-.72.72L10.5 6.76l.72-.72 1.5 1.5ZM3.963 9.716l6.037-6.037 1.5 1.5-6.037 6.037a.25.25 0 0 1-.126.065l-1.68.336.336-1.68a.25.25 0 0 1 .065-.126Z" />
                </svg>
              </div>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
