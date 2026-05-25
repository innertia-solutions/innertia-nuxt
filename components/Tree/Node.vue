<script setup>
import { IconChevronDown, IconChevronRight, IconLoader2, IconPlus, IconMinus } from '@tabler/icons-vue'

const props = defineProps({
  node:          { type: Object, required: true },
  columns:       { type: Array,  required: true },
  depth:         { type: Number, default: 0 },
  expanded:      { type: Object, required: true },
  loadingSet:    { type: Object, required: true },
  childrenById:  { type: Object, required: true },
  rowHref:       { type: [String, Function], default: null },
  clickableRows: { type: Boolean, default: true },
  nameColKey:    { type: String, default: 'name' },

  // 'table' — clásico con filas y columnas
  // 'list'  — vista compacta estilo file-tree (sin tabla, sin bordes de fila)
  variant:       { type: String, default: 'table' },

  // Checkbox selection (con cascada padre/hijo)
  checkable:         { type: Boolean, default: false },
  checkedSet:        { type: Object, default: null },
  indeterminateSet:  { type: Object, default: null },

  // Column visibility — map { [colKey]: boolean }. Si null, todas visibles.
  columnVisibility: { type: Object, default: null },
})

const emit = defineEmits(['toggle', 'row-click', 'check'])

const isExpanded   = computed(() => props.expanded.has(props.node.id))
const isLoading    = computed(() => props.loadingSet.has(props.node.id))
const hasChildren  = computed(() => !!props.node.has_children)
const isChecked       = computed(() => props.checkable && props.checkedSet?.has(props.node.id))
const isIndeterminate = computed(() => props.checkable && !isChecked.value && props.indeterminateSet?.has(props.node.id))

const children = computed(() => {
  if (Array.isArray(props.node.children)) return props.node.children
  return props.childrenById[props.node.id] ?? []
})

const visibleColumns = computed(() => {
  if (!props.columnVisibility) return props.columns
  return props.columns.filter(c => props.columnVisibility[c.key] !== false)
})

// Columnas adicionales (excluyendo la principal con el chevron)
const extraColumns = computed(() =>
  visibleColumns.value.filter(c => c.key !== props.nameColKey)
)

const onToggle = (e) => {
  e?.stopPropagation?.()
  emit('toggle', props.node)
}

const onRowClick = () => {
  if (!props.clickableRows) return
  if (props.rowHref) return
  emit('row-click', props.node)
}

const onCheck = (e) => {
  e?.stopPropagation?.()
  emit('check', props.node)
}

const href = computed(() => {
  if (!props.rowHref) return null
  return typeof props.rowHref === 'function' ? props.rowHref(props.node) : props.rowHref
})

const indentPx = computed(() => props.depth * 20)
</script>

<template>
  <!-- ════════════ Variante 'table' (clásica con <tr>) ════════════ -->
  <template v-if="variant === 'table'">
    <tr
      class="bg-card hover:bg-layer-hover transition-colors"
      :class="[
        clickableRows ? 'cursor-pointer' : '',
        isChecked ? 'bg-primary/5' : '',
      ]"
      @click="onRowClick"
    >
      <td v-if="checkable" class="w-10 px-4 py-2.5 align-middle" @click.stop>
        <input
          type="checkbox"
          :checked="isChecked"
          :indeterminate.prop="isIndeterminate"
          class="size-4 rounded border-card-line text-primary focus:ring-primary/30 cursor-pointer"
          @change="onCheck"
        />
      </td>

      <td
        v-for="col in visibleColumns"
        :key="col.key"
        class="px-4 py-2.5 text-sm align-middle"
      >
        <template v-if="col.key === nameColKey">
          <div class="flex items-center min-w-0" :style="{ paddingLeft: indentPx + 'px' }">
            <button
              v-if="hasChildren"
              type="button"
              class="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground mr-1.5 shrink-0"
              @click.stop="onToggle"
            >
              <IconLoader2 v-if="isLoading" class="size-3.5 animate-spin" />
              <IconChevronDown v-else-if="isExpanded" class="size-3.5" />
              <IconChevronRight v-else class="size-3.5" />
            </button>
            <span v-else class="size-5 mr-1.5 shrink-0" />

            <component
              :is="href ? 'NuxtLink' : 'span'"
              :to="href || undefined"
              class="min-w-0 flex items-center gap-x-2 truncate"
              :class="href ? 'hover:text-primary' : ''"
              @click="href ? $event.stopPropagation() : null"
            >
              <slot :name="`cell-${col.key}`" :row="node" :value="node[col.key]">
                <span class="truncate font-medium text-foreground">{{ node[col.key] }}</span>
              </slot>
            </component>
          </div>
        </template>

        <template v-else>
          <div class="truncate text-muted-foreground-1">
            <slot :name="`cell-${col.key}`" :row="node" :value="node[col.key]">
              {{ node[col.key] ?? '—' }}
            </slot>
          </div>
        </template>
      </td>
    </tr>

    <template v-if="isExpanded && children.length">
      <TreeNode
        v-for="child in children"
        :key="child.id"
        :node="child"
        :columns="columns"
        :depth="depth + 1"
        :variant="variant"
        :expanded="expanded"
        :loading-set="loadingSet"
        :children-by-id="childrenById"
        :row-href="rowHref"
        :clickable-rows="clickableRows"
        :name-col-key="nameColKey"
        :checkable="checkable"
        :checked-set="checkedSet"
        :indeterminate-set="indeterminateSet"
        :column-visibility="columnVisibility"
        @toggle="(n) => emit('toggle', n)"
        @row-click="(n) => emit('row-click', n)"
        @check="(n) => emit('check', n)"
      >
        <template v-for="col in columns" :key="col.key" #[`cell-${col.key}`]="slotProps">
          <slot :name="`cell-${col.key}`" v-bind="slotProps" />
        </template>
      </TreeNode>
    </template>
  </template>

  <!-- ════════════ Variante 'list' (compacta tipo file-tree) ════════════ -->
  <template v-else>
    <div
      class="group flex items-center gap-1.5 px-2 py-1 rounded-control hover:bg-muted-hover transition-colors"
      :class="[
        clickableRows ? 'cursor-pointer' : '',
        isChecked ? 'bg-primary/5' : '',
      ]"
      :style="{ paddingLeft: (indentPx + 8) + 'px' }"
      @click="onRowClick"
    >
      <!-- Expand button (+/-) o spacer -->
      <button
        v-if="hasChildren"
        type="button"
        class="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground shrink-0"
        @click.stop="onToggle"
      >
        <IconLoader2 v-if="isLoading" class="size-3.5 animate-spin" />
        <IconMinus v-else-if="isExpanded" class="size-3.5" />
        <IconPlus v-else class="size-3.5" />
      </button>
      <span v-else class="size-5 shrink-0" />

      <!-- Checkbox -->
      <input
        v-if="checkable"
        type="checkbox"
        :checked="isChecked"
        :indeterminate.prop="isIndeterminate"
        class="size-4 rounded border-card-line text-primary focus:ring-primary/30 cursor-pointer shrink-0"
        @click.stop
        @change="onCheck"
      />

      <!-- Label (columna principal) -->
      <component
        :is="href ? 'NuxtLink' : 'span'"
        :to="href || undefined"
        class="min-w-0 flex items-center gap-x-2 truncate text-sm"
        :class="href ? 'hover:text-primary' : ''"
        @click="href ? $event.stopPropagation() : null"
      >
        <slot :name="`cell-${nameColKey}`" :row="node" :value="node[nameColKey]">
          <span class="truncate text-foreground">{{ node[nameColKey] }}</span>
        </slot>
      </component>

      <!-- Columnas extra: a la derecha, mutadas -->
      <div v-if="extraColumns.length" class="ml-auto flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        <span v-for="col in extraColumns" :key="col.key" class="tabular-nums">
          <slot :name="`cell-${col.key}`" :row="node" :value="node[col.key]">
            {{ node[col.key] ?? '—' }}
          </slot>
        </span>
      </div>
    </div>

    <!-- Children con indent guide vertical -->
    <div
      v-if="isExpanded && children.length"
      class="relative"
    >
      <TreeNode
        v-for="child in children"
        :key="child.id"
        :node="child"
        :columns="columns"
        :depth="depth + 1"
        :variant="variant"
        :expanded="expanded"
        :loading-set="loadingSet"
        :children-by-id="childrenById"
        :row-href="rowHref"
        :clickable-rows="clickableRows"
        :name-col-key="nameColKey"
        :checkable="checkable"
        :checked-set="checkedSet"
        :indeterminate-set="indeterminateSet"
        :column-visibility="columnVisibility"
        @toggle="(n) => emit('toggle', n)"
        @row-click="(n) => emit('row-click', n)"
        @check="(n) => emit('check', n)"
      >
        <template v-for="col in columns" :key="col.key" #[`cell-${col.key}`]="slotProps">
          <slot :name="`cell-${col.key}`" v-bind="slotProps" />
        </template>
      </TreeNode>
    </div>
  </template>
</template>
