<script setup>
import {
  IconFileTypeXls,
  IconCodeDots,
  IconFileTypePdf,
  IconFileTypeCsv,
  IconDownload,
} from "@tabler/icons-vue";

const props = defineProps({
  tableRef: { type: Object, required: true },
});

const exportAllPages = ref(true);
const exportFilteredRows = ref(true);

const exportTable = (format) => {
  if (props.tableRef) {
    props.tableRef.exportTable(
      format,
      exportAllPages.value,
      exportFilteredRows.value
    );
  }
};
</script>
<template>
  <div
    class="hs-dropdown [--auto-close:inside] [--placement:bottom-right] relative inline-block"
  >
    <button
      id="hs-as-table-table-export-dropdown"
      type="button"
      class="py-1.5 sm:py-2 px-2.5 inline-flex items-center gap-x-1.5 text-sm sm:text-xs font-medium rounded-control border border-card-line bg-card text-foreground shadow-2xs hover:bg-muted-hover disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-muted-hover"
      aria-haspopup="menu"
      aria-expanded="false"
      aria-label="Dropdown"
    >
      <IconDownload class="shrink-0 size-4" stroke="1.5" />
      Exportar
    </button>
    <div
      class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden divide-y divide-card-line min-w-48 z-10 bg-dropdown shadow-md rounded-popover p-2 mt-2 dark:border dark:border-dropdown-line border-t border-card-line"
      role="menu"
      aria-orientation="vertical"
      aria-labelledby="hs-as-table-table-export-dropdown"
    >
      <div class="py-2 first:pt-0 last:pb-0">
        <a
          class="flex items-center gap-x-3 py-2 px-3 rounded-control text-sm text-foreground hover:bg-muted-hover focus:outline-hidden focus:bg-muted-hover"
          href="#"
          @click="exportTable('xlsx')"
        >
          <IconFileTypeXls class="shrink-0 size-5" stroke="1.5" />
          Excel
        </a>
        <a
          class="flex items-center gap-x-3 py-2 px-3 rounded-control text-sm text-foreground hover:bg-muted-hover focus:outline-hidden focus:bg-muted-hover"
          href="#"
          @click="exportTable('csv')"
        >
          <IconFileTypeCsv class="shrink-0 size-5" stroke="1.5" />
          CSV
        </a>
        <a
          class="flex items-center gap-x-3 py-2 px-3 rounded-control text-sm text-foreground hover:bg-muted-hover focus:outline-hidden focus:bg-muted-hover"
          href="#"
          @click="exportTable('pdf')"
        >
          <IconFileTypePdf class="shrink-0 size-5" stroke="1.5" />
          PDF
        </a>
        <a
          class="flex items-center gap-x-3 py-2 px-3 rounded-control text-sm text-foreground hover:bg-muted-hover focus:outline-hidden focus:bg-muted-hover"
          href="#"
          @click="exportTable('json')"
        >
          <IconCodeDots class="shrink-0 size-5" stroke="1.5" />
          JSON
        </a>
      </div>
      <!-- checkbox - todas las paginas -->
      <div
        class="flex flex-col gap-y-2 py-2 px-3"
        data-hs-dropdown-ignore-click
      >
        <label
          class="inline-flex items-center gap-2 text-sm text-foreground"
        >
          <input
            type="checkbox"
            v-model="exportAllPages"
            class="shrink-0 border-card-line rounded-control text-blue-600 focus:ring-blue-500 dark:bg-card"
          />
          Todas las páginas
        </label>

        <label
          class="inline-flex items-center gap-2 text-sm text-foreground"
        >
          <input
            type="checkbox"
            v-model="exportFilteredRows"
            class="shrink-0 border-card-line rounded-control text-blue-600 focus:ring-blue-500 dark:bg-card"
          />
          Solo filas filtradas
        </label>
      </div>
    </div>
  </div>
</template>
