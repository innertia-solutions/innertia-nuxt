<script setup>
import { IconSearch, IconLoader2, IconCheck, IconX } from '@tabler/icons-vue'

// Dense database view with inline cell editing — click cell → input → blur → mutation
const props = defineProps({
  endpoint: { type: String, required: true },
  columns: { type: Array, required: true }, // [{ key, label, editable?, type?: 'text'|'number'|'select', options?: [] }]
  name: { type: String, required: true },
  params: { type: Object, default: () => ({}) },
  updateMutation: { type: Function, default: null }, // (id, field, value) => Promise
  cached: { type: Boolean, default: false },
  searchPlaceholder: { type: String, default: 'Buscar...' },
  showSearch: { type: Boolean, default: true },
})

const emit = defineEmits(['row-click', 'cell-save'])

const tableRef = ref(null)

// ─── Inline editing ───────────────────────────────────────────────────────────
const editingCell = ref(null) // { rowId, key }
const editingValue = ref('')
const savingCell = ref(null)
const cellError = ref(null)

const startEdit = (row, col) => {
  if (!col.editable) return
  editingCell.value = { rowId: row.id, key: col.key }
  editingValue.value = row[col.key] ?? ''
  cellError.value = null
  nextTick(() => {
    const input = document.querySelector(`[data-cell-input="${row.id}-${col.key}"]`)
    input?.focus()
    input?.select()
  })
}

const cancelEdit = () => {
  editingCell.value = null
  editingValue.value = ''
  cellError.value = null
}

const saveEdit = async (row, col) => {
  if (!editingCell.value) return
  const newValue = editingValue.value
  const oldValue = row[col.key]

  if (newValue === String(oldValue ?? '')) {
    cancelEdit()
    return
  }

  editingCell.value = null
  savingCell.value = { rowId: row.id, key: col.key }

  try {
    if (props.updateMutation) {
      await props.updateMutation(row.id, col.key, newValue)
    }
    // Patch local row
    row[col.key] = newValue
    emit('cell-save', { id: row.id, field: col.key, value: newValue, oldValue })
    tableRef.value?.reload()
  } catch (e) {
    cellError.value = { rowId: row.id, key: col.key, message: e.message }
  } finally {
    savingCell.value = null
  }
}

const isEditing = (rowId, key) => editingCell.value?.rowId === rowId && editingCell.value?.key === key
const isSaving = (rowId, key) => savingCell.value?.rowId === rowId && savingCell.value?.key === key

const search = ref('')
const mergedParams = computed(() => ({ ...props.params }))

const reload = () => tableRef.value?.reload()
defineExpose({ reload })
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="showSearch" class="relative max-w-sm">
      <div class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
        <IconSearch class="size-4 text-slate-400" stroke="1.5" />
      </div>
      <input
        v-model="search"
        type="search"
        :placeholder="searchPlaceholder"
        class="block w-full rounded-lg border border-card-line bg-card text-foreground py-1.5 ps-9 pe-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>

    <!-- Dense table wrapper — override Table's default padding with compact styles -->
    <div class="overflow-x-auto border border-card-line rounded-xl">
      <Table
        ref="tableRef"
        :endpoint="endpoint"
        :columns="columns"
        :name="name"
        :params="mergedParams"
        :search="search"
        :cached="cached"
        :show-reload-button="false"
        class="[&_td]:py-1 [&_td]:px-2 [&_th]:py-1.5 [&_th]:px-2 [&_td]:text-xs [&_th]:text-xs"
        @row-click="emit('row-click', $event)"
      >
        <!-- Override each cell slot to support inline editing -->
        <template
          v-for="col in columns"
          :key="col.key"
          #[`cell-${col.key}`]="{ row }"
        >
          <!-- Editing state -->
          <div v-if="isEditing(row.id, col.key)" class="flex items-center gap-1 -mx-1">
            <select
              v-if="col.type === 'select' && col.options"
              v-model="editingValue"
              :data-cell-input="`${row.id}-${col.key}`"
              @blur="saveEdit(row, col)"
              @keydown.enter="saveEdit(row, col)"
              @keydown.escape="cancelEdit"
              class="flex-1 min-w-0 rounded border border-indigo-400 bg-card text-foreground py-0.5 px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option v-for="opt in col.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <input
              v-else
              v-model="editingValue"
              :type="col.type === 'number' ? 'number' : 'text'"
              :data-cell-input="`${row.id}-${col.key}`"
              @blur="saveEdit(row, col)"
              @keydown.enter="saveEdit(row, col)"
              @keydown.escape="cancelEdit"
              class="flex-1 min-w-0 rounded border border-indigo-400 bg-card text-foreground py-0.5 px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <!-- Saving state -->
          <div v-else-if="isSaving(row.id, col.key)" class="flex items-center gap-1 text-slate-400">
            <IconLoader2 class="size-3 animate-spin shrink-0" stroke="1.5" />
            <span class="truncate">{{ row[col.key] }}</span>
          </div>

          <!-- Error state -->
          <div
            v-else-if="cellError?.rowId === row.id && cellError?.key === col.key"
            :title="cellError.message"
            class="flex items-center gap-1 text-red-500 cursor-pointer"
            @click="startEdit(row, col)"
          >
            <IconX class="size-3 shrink-0" stroke="2" />
            <span class="truncate text-xs">{{ row[col.key] }}</span>
          </div>

          <!-- View state -->
          <div
            v-else
            :class="[
              'truncate',
              col.editable ? 'cursor-text hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded px-1 -mx-1 group relative' : ''
            ]"
            @click="col.editable ? startEdit(row, col) : emit('row-click', row)"
          >
            <slot :name="`cell-${col.key}`" :row="row">
              {{ row[col.key] }}
            </slot>
            <span
              v-if="col.editable"
              class="absolute inset-y-0 right-0 flex items-center opacity-0 group-hover:opacity-100 pr-1"
            >
              <svg class="size-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </span>
          </div>
        </template>
      </Table>
    </div>
  </div>
</template>
