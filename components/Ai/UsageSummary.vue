<script setup lang="ts">
/*
 * Ai.UsageSummary — AI consumption of the active space (backoffice), with an optional monthly budget
 * in USD (warning at 80 % and 100 %). Backend: \Innertia\Ai\Routes::tenant() → GET ai/usage/summary.
 *
 *   <Ai.UsageSummary endpoint="ai" :budget="settings.ai_budget_usd" />
 */
withDefaults(defineProps<{ endpoint?: string; budget?: number | null }>(), { endpoint: 'ai', budget: null })
</script>

<template>
  <Ai.UsageReport scope="tenant" :endpoint="endpoint" :budget="budget" />
</template>
