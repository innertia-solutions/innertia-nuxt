<script setup lang="ts">
import { IconAlertTriangle } from '@tabler/icons-vue'
import { bannerFor } from '../../composables/useBilling/internal/billing'

/*
 * Billing.StatusBanner — global backoffice banner when the space is past due or suspended
 * (read-only). Pass `status` (e.g. from the X-Billing-Status header or your own store) or let it
 * fetch GET {endpoint}/overview (only for users with billing.view).
 *
 *   <Billing.StatusBanner billing-route="/backoffice/billing" />
 */
const props = withDefaults(defineProps<{ status?: string | null; endpoint?: string; billingRoute?: string; fetch?: boolean }>(), {
  status: undefined, endpoint: 'billing', billingRoute: '/backoffice/billing', fetch: true,
})

const api = useApi()
const fetched = ref<string | null>(null)
onMounted(async () => {
  if (props.status !== undefined || !props.fetch) return
  try {
    const res: any = await api.get(`${props.endpoint.replace(/^\/+|\/+$/g, '')}/overview`)
    fetched.value = res?.subscription?.status ?? null
  } catch { /* no permission or billing off: no banner */ }
})
const banner = computed(() => bannerFor(props.status !== undefined ? props.status : fetched.value))
</script>

<template>
  <div v-if="banner" class="flex flex-wrap items-center gap-3 px-4 py-2 text-sm border-b"
    :class="banner.severity === 'danger' ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-warning/10 border-warning/30 text-warning'" role="alert">
    <IconAlertTriangle class="size-4 shrink-0" />
    <span class="font-medium">{{ banner.title }}.</span>
    <span class="flex-1 text-foreground">{{ banner.message }}</span>
    <NuxtLink :to="billingRoute" class="font-medium underline">Ver facturación</NuxtLink>
  </div>
</template>
