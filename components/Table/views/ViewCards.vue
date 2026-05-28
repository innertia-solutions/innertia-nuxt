<script setup>
const props = defineProps({
  table:         Object,
  loading:       Boolean,
  skeletonRows:  Array,
  checkable:     Boolean,
  gridClass:     String,
  search:        String,
  columnFilters: Array,
  bordered:      { type: Boolean, default: true },
})

const emit = defineEmits(['row-click'])
</script>

<template>
  <div :class="['relative pb-4', bordered ? 'pt-4 px-4' : '']">
    <div v-if="loading" :class="gridClass">
      <div v-for="(_, i) in skeletonRows" :key="'gsk-' + i" class="animate-pulse">
        <slot name="grid-skeleton">
          <div class="bg-card rounded-card border border-card-line p-4">
            <div class="space-y-3">
              <div class="h-4 bg-surface-1 rounded w-3/4"></div>
              <div class="h-4 bg-surface-1 rounded w-1/2"></div>
              <div class="h-6 bg-surface-1 rounded w-1/4"></div>
            </div>
          </div>
        </slot>
      </div>
    </div>

    <div v-else-if="table.getRowModel().rows.length > 0" :class="gridClass">
      <slot
        name="grid-item"
        v-for="row in table.getRowModel().rows"
        :key="row.id"
        :row="row.original"
        :tanstack-row="row"
        :is-selected="row.getIsSelected()"
        :checkable="checkable"
        :toggle-row="() => row.toggleSelected()"
        :on-row-click="(e) => emit('row-click', row, e)"
      >
        <div
          class="bg-card rounded-card border border-card-line p-4 hover:shadow-md transition-shadow relative cursor-pointer"
          :class="{ 'ring-2 ring-indigo-400 dark:ring-indigo-600': row.getIsSelected() }"
          @click="emit('row-click', row, $event)"
        >
          <div v-if="checkable" class="absolute top-2 left-2 z-10">
            <input type="checkbox" :checked="row.getIsSelected()" @change="row.toggleSelected()"
              class="rounded border-card-line dark:bg-card" @click.stop />
          </div>
          <div class="space-y-2" :class="{ 'pt-6': checkable }">
            <div v-for="cell in row.getVisibleCells().filter(c => c.column.id !== 'select')" :key="cell.id" class="flex justify-between">
              <span class="text-sm text-muted-foreground">{{ cell.column.columnDef.meta?.label ?? cell.column.id }}:</span>
              <span class="text-sm text-foreground">
                <slot :name="cell.column.id" :row="row.original" :value="cell.getValue()">{{ cell.getValue() }}</slot>
              </span>
            </div>
          </div>
        </div>
      </slot>
    </div>

    <div v-else class="flex items-center justify-center py-12">
      <slot v-if="!search && !columnFilters?.length" name="empty">
        <p class="text-muted-foreground text-lg">No hay registros</p>
      </slot>
      <slot v-else name="empty-search">
        <p class="text-muted-foreground text-lg">No hay registros en la búsqueda</p>
      </slot>
    </div>
  </div>
</template>
