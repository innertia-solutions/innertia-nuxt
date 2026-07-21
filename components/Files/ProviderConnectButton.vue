<script setup>
const props = defineProps({
  provider: { type: String, default: 'google_drive' },
  label: { type: String, default: 'Google Drive' },
})

const { status, connect, disconnect } = useProviderConnection(props.provider)
const { data, isLoading } = status()

const connected = computed(() => data.value?.connected ?? data.value?.data?.connected ?? false)
const email = computed(() => data.value?.email ?? data.value?.data?.email ?? null)
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <template v-if="connected">
      <span class="text-sm text-muted-foreground">{{ label }}: <span class="text-foreground font-medium">{{ email }}</span></span>
      <AppButton text="Desconectar" severity="secondary" size="sm" @click="disconnect" />
    </template>
    <AppButton v-else text="Conectar Google Drive" severity="primary" size="sm" :loading="isLoading" @click="connect" />
  </div>
</template>
