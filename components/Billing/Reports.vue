<script setup lang="ts">
import { IconDownload } from '@tabler/icons-vue'
import { REPORTS, reportCell, isNumericColumn, yearToDate } from '../../composables/useBilling/internal/billing'

/*
 * Billing.Reports — collection reports: invoiced revenue (by month/client/plan/product), receivables,
 * debt aging (0–30, 31–60, 61–90, 90+), collections (by month/method/client), MRR and consumption by
 * space, with date range and .xlsx export.
 * Backend: GET {endpoint}/reports/{report}(/export)?from=&to=&group_by=.
 *
 *   <Billing.Reports />
 */
const props = withDefaults(defineProps<{ endpoint?: string; initial?: string }>(), { endpoint: 'platform/billing', initial: 'revenue' })

const toast = useToast()
const billing = useBillingPlatform({ base: props.endpoint })
const download = useBillingDownload()
const active = ref(props.initial)
const def = computed(() => REPORTS.find(r => r.key === active.value) ?? REPORTS[0])
const range = reactive({ ...yearToDate(), group_by: '' })
watch(active, () => { range.group_by = def.value.groups[0]?.value ?? '' }, { immediate: true })
const params = computed(() => def.value.dated ? { from: range.from, to: range.to, group_by: range.group_by } : { group_by: range.group_by })
const query = billing.report(active, params)
const data = computed<any>(() => query.data.value)
const columns = computed<[string, string][]>(() => Object.entries(data.value?.columns ?? {}))

async function exportXlsx() {
  try {
    await download(`${billing.base}/reports/${active.value}/export`, `${active.value}.xlsx`, params.value)
  } catch {
    toast.error('No se pudo descargar el reporte.')
  }
}

const inputClass = 'h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-2 text-sm">
      <button v-for="r in REPORTS" :key="r.key" type="button" class="px-3 py-1.5 rounded-control border"
        :class="active === r.key ? 'border-primary bg-primary/10 text-primary' : 'border-card-line text-muted-foreground hover:text-foreground'" @click="active = r.key">
        {{ r.label }}
      </button>
    </div>

    <div class="flex flex-wrap items-end gap-3 text-sm">
      <template v-if="def.dated">
        <label class="space-y-1"><span class="block text-xs text-muted-foreground">Desde</span><input v-model="range.from" type="date" :class="inputClass" /></label>
        <label class="space-y-1"><span class="block text-xs text-muted-foreground">Hasta</span><input v-model="range.to" type="date" :class="inputClass" /></label>
      </template>
      <label v-if="def.groups.length" class="space-y-1"><span class="block text-xs text-muted-foreground">Agrupar por</span>
        <select v-model="range.group_by" :class="inputClass"><option v-for="g in def.groups" :key="g.value" :value="g.value">{{ g.label }}</option></select>
      </label>
      <span class="flex-1" />
      <App.Button text="Excel" size="sm" outline :icon="IconDownload" @click="exportXlsx" />
    </div>

    <div class="bg-card border border-card-line rounded-card overflow-x-auto">
      <div v-if="query.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="query.isError.value || !data" class="p-8 text-center text-sm text-muted-foreground">
        No se pudo cargar el reporte.
        <button type="button" class="text-primary hover:underline" @click="query.refetch()">Reintentar</button>
      </div>
      <div v-else-if="!data.rows.length" class="p-8 text-center text-sm text-muted-foreground">Sin datos para el período.</div>
      <table v-else class="w-full text-sm">
        <thead class="text-xs uppercase text-muted-foreground">
          <tr class="border-b border-card-line">
            <th v-for="[key, label] in columns" :key="key" class="font-medium px-4 py-2" :class="isNumericColumn(key) ? 'text-right' : 'text-left'">{{ label }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-card-line">
          <tr v-for="(row, idx) in data.rows" :key="idx">
            <td v-for="[key] in columns" :key="key" class="px-4 py-2" :class="isNumericColumn(key) ? 'text-right whitespace-nowrap' : ''">{{ reportCell(key, row[key]) }}</td>
          </tr>
        </tbody>
        <tfoot v-if="Object.keys(data.totals ?? {}).length" class="border-t border-card-line font-medium">
          <tr>
            <td v-for="([key], i) in columns" :key="key" class="px-4 py-2" :class="isNumericColumn(key) ? 'text-right whitespace-nowrap' : ''">
              {{ i === 0 ? 'Total' : (key in data.totals ? reportCell(key, data.totals[key]) : '') }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>
