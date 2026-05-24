<script setup>
import { IconChevronDown, IconChevronRight, IconLoader2 } from '@tabler/icons-vue'

const props = defineProps({
  node:              { type: Object, required: true },
  columns:           { type: Array,  required: true },
  depth:             { type: Number, default: 0 },
  expanded:          { type: Object, required: true },   // Set<id>
  loadingSet:        { type: Object, required: true },   // Set<id>
  childrenById:      { type: Object, required: true },   // id -> array
  gridTemplateColumns: { type: String, required: true },
  rowHref:           { type: [String, Function], default: null },
  clickableRows:     { type: Boolean, default: true },
})

const emit = defineEmits(['toggle', 'row-click'])

const isExpanded = computed(() => props.expanded.has(props.node.id))
const isLoading  = computed(() => props.loadingSet.has(props.node.id))

const hasChildren = computed(() => !!props.node.has_children)

// Hijos a renderizar: vienen eager en node.children, o lazy en childrenById
const children = computed(() => {
  if (Array.isArray(props.node.children)) return props.node.children
  return props.childrenById[props.node.id] ?? []
})

const nameKey  = computed(() => props.columns[0]?.key ?? 'name')
const restCols = computed(() => props.columns.slice(1))

const onToggle = (e) => {
  e?.stopPropagation?.()
  emit('toggle', props.node)
}

const onRowClick = () => {
  if (!props.clickableRows) return
  emit('row-click', props.node)
}

const href = computed(() => {
  if (!props.rowHref) return null
  return typeof props.rowHref === 'function' ? props.rowHref(props.node) : props.rowHref
})
</script>

<template>
  <li>
    <component
      :is="href ? 'NuxtLink' : 'div'"
      :to="href || undefined"
      class="grid items-center gap-x-4 px-3 py-2 text-sm border-b border-card-line/40 hover:bg-muted/40 transition-colors"
      :class="clickableRows ? 'cursor-pointer' : ''"
      :style="{ gridTemplateColumns }"
      @click="onRowClick"
    >
      <!-- Name cell: indent + chevron + name -->
      <div class="flex items-center min-w-0" :style="{ paddingLeft: `${depth * 20}px` }">
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

        <slot :name="`cell-${nameKey}`" :row="node" :value="node[nameKey]">
          <span class="truncate font-medium text-foreground">{{ node[nameKey] }}</span>
        </slot>
      </div>

      <!-- Rest of columns -->
      <div v-for="col in restCols" :key="col.key" class="truncate text-muted-foreground">
        <slot :name="`cell-${col.key}`" :row="node" :value="node[col.key]">
          {{ node[col.key] ?? '—' }}
        </slot>
      </div>
    </component>

    <!-- Children -->
    <ul v-if="isExpanded && children.length">
      <TreeNode
        v-for="child in children"
        :key="child.id"
        :node="child"
        :columns="columns"
        :depth="depth + 1"
        :expanded="expanded"
        :loading-set="loadingSet"
        :children-by-id="childrenById"
        :grid-template-columns="gridTemplateColumns"
        :row-href="rowHref"
        :clickable-rows="clickableRows"
        @toggle="(n) => emit('toggle', n)"
        @row-click="(n) => emit('row-click', n)"
      >
        <template v-for="col in columns" :key="col.key" #[`cell-${col.key}`]="slotProps">
          <slot :name="`cell-${col.key}`" v-bind="slotProps" />
        </template>
      </TreeNode>
    </ul>
  </li>
</template>
