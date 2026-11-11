<script setup>
/**
 * <Files.ProviderOrigin> — franja "Importado de Google Drive" con "Actualizar" y "Abrir en Drive".
 * Solo se muestra si el archivo vino de un proveedor (file.provider). El botón aparece si
 * file.can_refresh (fuente disponible). Emite `changed` cuando hubo versión nueva.
 *
 *   <Files.ProviderOrigin :file="file" drive-base="platform" @changed="refetch" />
 */
import { IconBrandGoogleDrive, IconRefresh, IconExternalLink } from '@tabler/icons-vue'
import { isFinished, refreshOutcome } from '../../composables/useFileImports/internal/progress'

const props = defineProps({
  file:      { type: Object, required: true },
  driveBase: { type: String, default: '' },
})
const emit = defineEmits(['changed'])

const toast = useToast()
const queryClient = useQueryClient()
const { refresh, track } = useFileImports(() => props.driveBase)
const importId = ref(null)
const tracker = track(importId)
const busy = computed(() => refresh.isPending.value || (!!importId.value && !isFinished(tracker.data.value?.status)))

const syncedLabel = computed(() => {
  const at = props.file.external_synced_at
  return at ? new Date(at).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : null
})

async function onRefresh() {
  try {
    const imp = await refresh.mutateAsync(props.file.id)
    importId.value = imp.id
  } catch (e) {
    toast.error(e?.data?.message ?? 'No se pudo actualizar desde Google Drive.')
  }
}

watch(() => tracker.data.value?.status, (status) => {
  if (!isFinished(status)) return
  const outcome = refreshOutcome(tracker.data.value)
  if (outcome.kind === 'failed') toast.error(outcome.message)
  else toast.success(outcome.message)
  if (outcome.kind === 'updated') {
    queryClient.invalidateQueries({ queryKey: ['files', 'versions'] })
    emit('changed')
  }
  importId.value = null
})

// Sin esto, un error al consultar el estado deja el botón cargando para siempre.
watch(() => tracker.isError.value, (failed) => {
  if (!failed || !importId.value) return
  toast.error(tracker.error.value?.data?.message ?? 'No se pudo consultar el estado de la actualización.')
  importId.value = null
})
</script>

<template>
  <div v-if="file.provider" class="flex flex-wrap items-center gap-2 rounded-control border border-card-line bg-card px-3 py-2 text-xs">
    <IconBrandGoogleDrive class="size-4 shrink-0 text-muted-foreground" />
    <span class="flex-1 min-w-0 text-muted-foreground">
      Importado de Google Drive<template v-if="syncedLabel"> · sincronizado {{ syncedLabel }}</template>
    </span>
    <a v-if="file.external_url" :href="file.external_url" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
      <IconExternalLink class="size-3.5" /> Abrir en Drive
    </a>
    <AppButton v-if="file.can_refresh" text="Actualizar" :icon="IconRefresh" severity="secondary" size="xs" :loading="busy" @click="onRefresh" />
  </div>
</template>
