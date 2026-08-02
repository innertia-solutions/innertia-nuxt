<script setup>
const props = defineProps({
  label:   { type: String, required: true },
  percent: { type: Number, default: null }, // 0..100 o null
})
const series = computed(() => [props.percent == null ? 0 : Math.max(0, Math.min(100, props.percent))])
const options = computed(() => ({
  labels: [props.label],
  plotOptions: { radialBar: { dataLabels: { value: { formatter: (v) => `${Math.round(v)}%` } } } },
}))
</script>

<template>
  <div class="rounded-card border border-card-line bg-card p-2">
    <Chart v-if="percent != null" type="radialBar" :series="series" :options="options" :height="180" />
    <div v-else class="flex h-[180px] flex-col items-center justify-center text-muted-foreground">
      <span class="text-sm">{{ label }}</span>
      <span class="text-xs">sin datos</span>
    </div>
  </div>
</template>
