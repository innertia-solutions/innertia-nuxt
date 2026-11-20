<script setup lang="ts">
import { formatMoney, formatQuantity, usageProgress, type UsageEstimate } from '../../composables/useBilling/internal/billing'

/*
 * Billing.UsageTable — consumption of the current period per meter vs what the plan includes,
 * with the estimated charge. Used by Billing.SpaceSubscription and Billing.Overview.
 */
withDefaults(defineProps<{ usage: UsageEstimate[]; currency?: string }>(), { currency: 'CLP' })

const barClass = (level: string) => level === 'over' ? 'bg-danger' : level === 'warning' ? 'bg-warning' : 'bg-primary'
</script>

<template>
  <div>
    <p v-if="!usage.length" class="text-sm text-muted-foreground">El plan no tiene consumo medido.</p>
    <ul v-else class="divide-y divide-card-line">
      <li v-for="u in usage" :key="u.meter.key" class="py-2 text-sm">
        <div class="flex items-center gap-3">
          <span class="flex-1 text-foreground">{{ u.meter.label }}</span>
          <span class="text-muted-foreground">
            <template v-if="u.meter.valued_by_cost">{{ formatMoney(u.cost, currency) }} de costo (+{{ u.markup_percent ?? 0 }} %)</template>
            <template v-else>{{ formatQuantity(u.quantity, u.meter.unit) }}<template v-if="u.included_quantity"> de {{ formatQuantity(u.included_quantity, u.meter.unit) }} incluidos</template></template>
          </span>
          <span class="w-28 text-right font-medium">{{ formatMoney(u.estimated_amount, currency) }}</span>
        </div>
        <div v-if="usageProgress(u).percent !== null" class="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div class="h-full rounded-full" :class="barClass(usageProgress(u).level)" :style="{ width: `${Math.min(100, usageProgress(u).percent ?? 0)}%` }" />
        </div>
      </li>
    </ul>
  </div>
</template>
