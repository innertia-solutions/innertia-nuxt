<script setup lang="ts">
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-vue'
import {
  featureLabel, formatUsd, unitsLabel, monthKey, shiftMonth, monthLabel, barHeights, budgetState, compactNumber, type UsageSummary,
} from '../../composables/useAiUsage/internal/aiUsage'

/*
 * Ai.UsageReport — AI consumption of a month: totals, by feature, daily bars, top days and (platform)
 * by space. Cost in USD estimated with the model prices in force when each usage was recorded.
 *
 *   <Ai.UsageReport />                                          platform: GET platform/ai/usage/report
 *   <Ai.UsageReport scope="tenant" endpoint="ai" :budget="50" /> backoffice: GET ai/usage/summary
 */
const props = withDefaults(defineProps<{
  endpoint?: string
  scope?: 'platform' | 'tenant'
  tenantId?: string | null
  budget?: number | null
}>(), { scope: 'platform', tenantId: null, budget: null })

const month = ref(monthKey())
const tenant = computed(() => props.tenantId ?? null)
const query = useAiUsage(month, { base: props.endpoint, scope: props.scope, tenantId: tenant })
const data = computed(() => query.data.value as UsageSummary | undefined)

const daily = computed(() => data.value?.daily ?? [])
const heights = computed(() => barHeights(daily.value.map(d => d.cost_usd)))
const topDays = computed(() => [...daily.value].filter(d => d.events > 0).sort((a, b) => b.cost_usd - a.cost_usd).slice(0, 5))
const budget = computed(() => budgetState(data.value?.totals.cost_usd ?? 0, props.budget))
const isCurrent = computed(() => month.value >= monthKey())

function exportCsv() {
  if (!data.value) return
  const rows = [['fecha', 'eventos', 'costo_usd', 'tokens_entrada', 'tokens_salida', 'audio_segundos', 'caracteres_tts']]
  for (const d of daily.value) rows.push([d.date, String(d.events), String(d.cost_usd), String(d.input_tokens), String(d.output_tokens), String(d.audio_seconds), String(d.tts_chars)])
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `consumo-ia-${month.value}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="p-1.5 rounded-control hover:bg-muted" aria-label="Mes anterior" @click="month = shiftMonth(month, -1)">
        <IconChevronLeft class="size-4" />
      </button>
      <span class="text-sm font-medium text-foreground min-w-36 text-center">{{ monthLabel(month) }}</span>
      <button type="button" class="p-1.5 rounded-control hover:bg-muted disabled:opacity-40" aria-label="Mes siguiente" :disabled="isCurrent" @click="month = shiftMonth(month, 1)">
        <IconChevronRight class="size-4" />
      </button>
      <span class="flex-1" />
      <App.Button text="Exportar CSV" size="xs" :disabled="!data" @click="exportCsv" />
    </div>

    <div v-if="query.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
    <div v-else-if="query.isError.value || !data" class="p-8 text-center text-sm text-muted-foreground">
      No se pudo cargar el consumo.
      <button type="button" class="text-primary hover:underline" @click="query.refetch()">Reintentar</button>
    </div>
    <template v-else>
      <div class="grid gap-3 sm:grid-cols-3">
        <App.StatCard label="Costo estimado" :value="formatUsd(data.totals.cost_usd)" :hint="data.totals.unpriced_events ? `${data.totals.unpriced_events} usos sin precio` : ''" />
        <App.StatCard label="Usos" :value="compactNumber(data.totals.events)" />
        <App.StatCard label="Unidades" :value="unitsLabel(data.totals)" />
      </div>

      <div v-if="budget" class="rounded-card border p-3 text-sm"
        :class="budget.level === 'over' ? 'border-danger/40 bg-danger/5 text-danger' : budget.level === 'warning' ? 'border-warning/40 bg-warning/5 text-warning' : 'border-card-line bg-card text-foreground'">
        Presupuesto mensual: {{ budget.percent }} % usado ({{ formatUsd(data.totals.cost_usd) }} de {{ formatUsd(budget ? props.budget : 0) }}).
      </div>

      <div class="bg-card border border-card-line rounded-card p-4">
        <p class="text-sm font-medium text-foreground mb-3">Costo por día</p>
        <div class="flex items-end gap-0.5 h-32">
          <div v-for="(d, i) in daily" :key="d.date" class="flex-1 bg-primary/70 rounded-t-sm min-h-px" :style="{ height: `${heights[i]}%` }"
            :title="`${d.date}: ${formatUsd(d.cost_usd)} · ${d.events} usos`" />
        </div>
        <div class="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{{ daily[0]?.date }}</span><span>{{ daily[daily.length - 1]?.date }}</span>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="bg-card border border-card-line rounded-card">
          <p class="text-sm font-medium text-foreground px-4 pt-3">Por función</p>
          <p v-if="!data.by_feature.length" class="px-4 py-6 text-sm text-muted-foreground">Sin consumo en el mes.</p>
          <ul v-else class="divide-y divide-card-line">
            <li v-for="f in data.by_feature" :key="f.feature ?? 'none'" class="flex items-center gap-3 px-4 py-2 text-sm">
              <span class="flex-1 text-foreground">{{ featureLabel(f.feature) }}</span>
              <span class="text-xs text-muted-foreground">{{ unitsLabel(f) }}</span>
              <span class="w-28 text-right font-medium">{{ formatUsd(f.cost_usd) }}</span>
            </li>
          </ul>
        </div>

        <div class="bg-card border border-card-line rounded-card">
          <p class="text-sm font-medium text-foreground px-4 pt-3">Días de mayor consumo</p>
          <p v-if="!topDays.length" class="px-4 py-6 text-sm text-muted-foreground">Sin consumo en el mes.</p>
          <ul v-else class="divide-y divide-card-line">
            <li v-for="d in topDays" :key="d.date" class="flex items-center gap-3 px-4 py-2 text-sm">
              <span class="flex-1 text-foreground">{{ d.date }}</span>
              <span class="text-xs text-muted-foreground">{{ d.events }} usos</span>
              <span class="w-28 text-right font-medium">{{ formatUsd(d.cost_usd) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="scope === 'platform' && data.by_tenant" class="bg-card border border-card-line rounded-card">
        <p class="text-sm font-medium text-foreground px-4 pt-3">Por espacio</p>
        <p v-if="!data.by_tenant.length" class="px-4 py-6 text-sm text-muted-foreground">Sin consumo en el mes.</p>
        <ul v-else class="divide-y divide-card-line">
          <li v-for="t in data.by_tenant" :key="t.tenant_id ?? 'none'" class="flex items-center gap-3 px-4 py-2 text-sm">
            <span class="flex-1 text-foreground">{{ t.tenant_name ?? (t.tenant_id ? `Espacio ${t.tenant_id}` : 'Sin espacio (plataforma)') }}</span>
            <span class="text-xs text-muted-foreground">{{ unitsLabel(t) }}</span>
            <span class="w-28 text-right font-medium">{{ formatUsd(t.cost_usd) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
