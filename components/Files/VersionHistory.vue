<script setup>
/**
 * <Files.VersionHistory> — historial de versiones de un archivo: descargar cualquiera,
 * restaurar (crea una versión nueva) y subir una versión nueva.
 *
 *   <Files.VersionHistory files-base="platform/files" :file-id="file.id" @changed="refetch" />
 */
import { IconDownload, IconRestore, IconUpload, IconHistory } from '@tabler/icons-vue'
import { versionSourceLabel, formatBytes, versionResultMessage } from '../../composables/useFileVersions/internal/versions'

const props = defineProps({
  filesBase:    { type: String, required: true },
  fileId:       { type: String, required: true },
  allowRestore: { type: Boolean, default: true },
  allowUpload:  { type: Boolean, default: true },
})
const emit = defineEmits(['changed'])

const toast = useToast()
const { confirm } = useModal()
const { list, restore, replace } = useFileVersions(() => ({ filesBase: props.filesBase, fileId: props.fileId }))
const versions = computed(() => list.data.value ?? [])
const restoring = ref(null)

function fmtDate(v) {
  return v ? new Date(v).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

async function onRestore(v) {
  if (!await confirm({ title: `Restaurar v${v.version}`, message: 'Se creará una versión nueva con este contenido. El historial no se borra.', confirmText: 'Restaurar' })) return
  restoring.value = v.version
  try {
    const res = await restore.mutateAsync(v.version)
    toast.success(versionResultMessage(res))
    if (res.status === 'created') emit('changed', res.file)
  } catch (e) {
    toast.error(e?.data?.message ?? 'No se pudo restaurar la versión.')
  } finally {
    restoring.value = null
  }
}

const picker = ref(null)
async function onPick(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    const res = await replace.mutateAsync(file)
    toast.success(versionResultMessage(res))
    if (res.status === 'created') emit('changed', res.file)
  } catch (err) {
    toast.error(err?.data?.message ?? 'No se pudo subir la nueva versión.')
  }
}
</script>

<template>
  <div class="rounded-card border border-card-line bg-card">
    <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-card-line">
      <p class="flex items-center gap-1.5 text-sm font-medium text-foreground"><IconHistory class="size-4 text-muted-foreground" /> Versiones</p>
      <template v-if="allowUpload">
        <input ref="picker" type="file" class="hidden" @change="onPick">
        <AppButton text="Subir nueva versión" :icon="IconUpload" severity="secondary" size="xs" :loading="replace.isPending.value" @click="picker?.click()" />
      </template>
    </div>

    <p v-if="list.isLoading.value" class="px-4 py-3 text-sm text-muted-foreground">Cargando…</p>
    <p v-else-if="list.error.value" class="px-4 py-3 text-sm text-red-600 dark:text-red-400">{{ list.error.value?.data?.message ?? 'No se pudo cargar el historial.' }}</p>
    <ul v-else class="divide-y divide-card-line">
      <li v-for="v in versions" :key="v.version" class="flex items-center gap-3 px-4 py-2.5 text-sm">
        <span class="w-9 shrink-0 font-mono text-xs" :class="v.is_current ? 'text-primary font-semibold' : 'text-muted-foreground'">v{{ v.version }}</span>
        <div class="flex-1 min-w-0">
          <p class="text-foreground truncate">
            {{ versionSourceLabel(v.source, v.restored_from_version) }}
            <span v-if="v.is_current" class="ml-1 rounded-control bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Vigente</span>
          </p>
          <p class="text-[11px] text-muted-foreground">{{ fmtDate(v.created_at) }} · {{ formatBytes(v.size) }}</p>
        </div>
        <a v-if="v.download_url" :href="v.download_url" class="text-muted-foreground hover:text-primary" title="Descargar">
          <IconDownload class="size-4" />
        </a>
        <button v-if="allowRestore && !v.is_current" type="button" class="text-muted-foreground hover:text-primary disabled:opacity-50"
          :disabled="restoring !== null" title="Restaurar" @click="onRestore(v)">
          <IconRestore class="size-4" :class="restoring === v.version ? 'animate-spin' : ''" />
        </button>
      </li>
    </ul>
  </div>
</template>
