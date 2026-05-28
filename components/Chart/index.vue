<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

const props = defineProps({
  /** Tipo de gráfico: line | bar | area | donut | pie | radialBar | scatter | heatmap */
  type:        { type: String, default: 'line' },
  /** Series de datos — formato ApexCharts */
  series:      { type: Array, required: true },
  /** Categorías para el eje X */
  categories:  { type: Array, default: () => [] },
  /** Altura del gráfico en px o string CSS */
  height:      { type: [Number, String], default: 320 },
  /** Opciones ApexCharts adicionales — se fusionan sobre las defaults */
  options:     { type: Object, default: () => ({}) },
  /** Colores personalizados. Si se omite, usa los tokens --chart-* */
  colors:      { type: Array, default: null },
  /** Muestra barra de herramientas */
  toolbar:     { type: Boolean, default: false },
  /** Animación al montar */
  animated:    { type: Boolean, default: true },
  /** Curva de líneas: smooth | straight | stepline */
  curve:       { type: String, default: 'smooth' },
  /** Grosor de líneas (solo line/area) */
  strokeWidth: { type: [Number, Array], default: 2 },
  /** Mostrar dataLabels */
  dataLabels:  { type: Boolean, default: false },
  /** Color de fondo de la zona — para area charts */
  fillOpacity: { type: [Number, Array], default: undefined },
})

// ── Resolución de CSS vars a colores reales ───────────────────────────────────
const resolveCSSColor = (varName) => {
  if (!process.client) return null
  const el = document.createElement('span')
  el.style.cssText = `display:none;color:var(${varName})`
  document.body.appendChild(el)
  const computed = getComputedStyle(el).color // siempre devuelve rgb(r,g,b)
  document.body.removeChild(el)
  // rgb(r, g, b) → #rrggbb
  const match = computed.match(/\d+/g)
  if (!match || match.length < 3) return null
  return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

const resolveCSSVar = (varName) => {
  if (!process.client) return ''
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}

// ── Dark mode reactive ────────────────────────────────────────────────────────
const isDark = useState('isDark', () => false)

// ── Paleta dinámica ───────────────────────────────────────────────────────────
const CHART_VARS = [
  '--chart-primary',
  '--chart-2', '--chart-3', '--chart-4', '--chart-5',
  '--chart-6', '--chart-7',
]

const resolvedColors = computed(() => {
  // isDark.value registra reactividad; los colores se re-resuelven al cambiar el tema
  void isDark.value
  if (props.colors) return props.colors
  return CHART_VARS.map(v => resolveCSSColor(v)).filter(Boolean)
})

// ── Opciones base ─────────────────────────────────────────────────────────────
const baseOptions = computed(() => {
  void isDark.value // trigger reactivity on dark mode toggle
  const mutedFg    = resolveCSSColor('--color-muted-foreground') ?? '#9ca3af'
  const cardLine   = resolveCSSColor('--color-card-line') ?? '#e5e7eb'
  const tooltipBg  = resolveCSSColor('--color-card') ?? '#ffffff'
  const tooltipFg  = resolveCSSColor('--color-foreground') ?? '#111827'

  const isDonutLike = ['donut', 'pie', 'radialBar'].includes(props.type)

  const opts = {
    chart: {
      background:  'transparent',
      toolbar:     { show: props.toolbar },
      fontFamily:  'inherit',
      foreColor:   mutedFg,
      animations:  { enabled: props.animated },
      redrawOnWindowResize: true,
    },
    colors: resolvedColors.value,

    stroke: isDonutLike ? undefined : {
      curve: props.curve,
      width: props.strokeWidth,
    },

    dataLabels: {
      enabled: props.dataLabels,
      style:   { fontFamily: 'inherit', fontSize: '11px' },
    },

    ...(props.fillOpacity !== undefined ? {
      fill: { opacity: props.fillOpacity },
    } : {}),

    xaxis: isDonutLike ? undefined : {
      categories:   props.categories,
      axisBorder:   { show: false },
      axisTicks:    { show: false },
      labels: {
        style: { colors: mutedFg, fontFamily: 'inherit', fontSize: '12px' },
      },
    },

    yaxis: isDonutLike ? undefined : {
      labels: {
        style: { colors: mutedFg, fontFamily: 'inherit', fontSize: '12px' },
      },
    },

    grid: isDonutLike ? { show: false } : {
      borderColor:     cardLine,
      strokeDashArray: 4,
      xaxis:           { lines: { show: false } },
    },

    legend: {
      fontFamily: 'inherit',
      fontSize:   '13px',
      labels:     { colors: tooltipFg },
    },

    tooltip: {
      theme: isDark.value ? 'dark' : 'light',
      style: { fontFamily: 'inherit', fontSize: '12px' },
      x:     { show: !isDonutLike },
    },

    plotOptions: props.type === 'bar' ? {
      bar: { borderRadius: 4, columnWidth: '60%' },
    } : props.type === 'radialBar' ? {
      radialBar: {
        hollow:    { size: '60%' },
        dataLabels: {
          name:  { color: tooltipFg, fontFamily: 'inherit' },
          value: { color: tooltipFg, fontFamily: 'inherit', fontSize: '20px' },
        },
      },
    } : undefined,
  }

  // Limpiar undefined para que ApexCharts no se confunda
  return JSON.parse(JSON.stringify(opts))
})

// ── Merge profundo de opciones ────────────────────────────────────────────────
const mergedOptions = computed(() => deepMerge(baseOptions.value, props.options))

function deepMerge(base, override) {
  const result = { ...base }
  for (const key of Object.keys(override ?? {})) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      base[key] !== null &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key])
    } else {
      result[key] = override[key]
    }
  }
  return result
}
</script>

<template>
  <ClientOnly>
    <VueApexCharts
      :type="type"
      :height="height"
      :series="series"
      :options="mergedOptions"
    />
    <template #fallback>
      <div
        :style="{ height: typeof height === 'number' ? height + 'px' : height }"
        class="flex items-center justify-center bg-surface rounded-card"
      >
        <div class="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    </template>
  </ClientOnly>
</template>
