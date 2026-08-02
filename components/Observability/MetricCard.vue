<script setup>
defineProps({
  label:    { type: String, required: true },
  value:    { type: [String, Number], default: '—' },
  sublabel: { type: String, default: '' },
  tone:     { type: String, default: 'neutral' }, // neutral | good | warn | bad
})
const TONE = {
  neutral: 'text-foreground',
  good:    'text-emerald-600 dark:text-emerald-400',
  warn:    'text-amber-600 dark:text-amber-400',
  bad:     'text-red-600 dark:text-red-400',
}
</script>

<template>
  <div class="rounded-card border border-card-line bg-card p-4">
    <p class="text-xs text-muted-foreground">{{ label }}</p>
    <p class="mt-1 text-2xl font-bold" :class="TONE[tone] ?? TONE.neutral">{{ value }}</p>
    <p v-if="sublabel" class="mt-0.5 text-xs text-muted-foreground">{{ sublabel }}</p>
  </div>
</template>
