<script setup>
import { IconCircleCheck, IconCircleX, IconLoader2, IconCircleDashed, IconPlayerSkipForward, IconUpload, IconDownload, IconTrash, IconFlask } from '@tabler/icons-vue'

const props = defineProps({
  filesBase: { type: String, required: true },
  directoriesBase: { type: String, required: true },
  expectedDisk: { type: String, default: null },
  grants: { type: Boolean, default: true },
  grantee: { type: Object, default: null },
})

const { results, running, summary, run, abort } = useStorageTestRunner({
  filesBase: props.filesBase,
  directoriesBase: props.directoriesBase,
  expectedDisk: props.expectedDisk,
  grants: props.grants,
  grantee: props.grantee,
})

const api = useApi()
const { upload } = useFile()
const toast = useToast()

const file = ref(null)
const ran = ref(false)
const open = reactive({})
const LARGE = 50 * 1024 * 1024

function onPick(e) { file.value = e.target.files?.[0] ?? null }
function fmtSize(b) { return b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB` }

async function execute() {
  if (!file.value) return
  ran.value = true
  await run(file.value)
}

onBeforeUnmount(abort)

// ── Acciones manuales: subir de ejemplo (queda guardado) / descargar / borrar ──
const sample = ref(null)
const sampleBusy = ref(false)
async function uploadSample() {
  if (!file.value) return
  sampleBusy.value = true
  try {
    const res = await upload(props.filesBase, file.value, { extraData: { visibility: 'auth' } })
    sample.value = res?.data ?? res
    toast.success(`Subido a "${sample.value.disk}".`)
  } catch (e) {
    toast.error(e?.data?.message ?? 'No se pudo subir.')
  } finally { sampleBusy.value = false }
}
async function deleteSample() {
  try {
    await api.delete(`${props.filesBase}/${sample.value.id}`, { params: { force: 1 } })
    sample.value = null
  } catch (e) { toast.error(e?.data?.message ?? 'No se pudo borrar.') }
}

const ICONS = { ok: IconCircleCheck, failed: IconCircleX, running: IconLoader2, pending: IconCircleDashed, skipped: IconPlayerSkipForward }
const COLORS = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-red-600 dark:text-red-400',
  running: 'text-primary animate-spin',
  pending: 'text-muted-foreground',
  skipped: 'text-muted-foreground',
}
</script>

<template>
  <div class="space-y-4">
    <div class="bg-card border border-card-line rounded-card p-5 space-y-3">
      <div class="flex items-center gap-2">
        <IconFlask class="size-4 text-primary" />
        <p class="text-sm font-semibold text-foreground">Probar almacenamiento con tu archivo</p>
      </div>
      <p class="text-xs text-muted-foreground">
        Se sube tu archivo y se recorre la API real: directorios, descarga con verificación de integridad,
        renombrar, público/privado, link compartido, permisos, papelera y borrado. Al final se limpia todo.
      </p>
      <input type="file" :disabled="running" class="block w-full text-sm text-foreground file:mr-3 file:rounded-control file:border-0 file:bg-primary/10 file:text-primary file:px-3 file:py-1.5" @change="onPick">
      <p v-if="file" class="text-xs text-muted-foreground">
        {{ file.name }} · {{ fmtSize(file.size) }} · {{ file.type || 'tipo desconocido' }}
        <span v-if="file.size > LARGE" class="text-amber-600 dark:text-amber-400"> — archivo grande, la prueba puede tardar.</span>
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <AppButton :text="ran ? 'Volver a ejecutar' : 'Ejecutar pruebas'" severity="primary" size="sm" :disabled="!file" :loading="running" @click="execute" />
        <AppButton v-if="running" text="Cancelar" severity="secondary" size="sm" @click="abort" />
        <span class="grow" />
        <AppButton text="Subir de ejemplo" :icon="IconUpload" severity="secondary" size="sm" :disabled="!file || running" :loading="sampleBusy" @click="uploadSample" />
      </div>
      <div v-if="sample" class="flex items-center gap-3 text-xs rounded-control border border-card-line p-2">
        <span class="text-foreground truncate">{{ sample.original_name }}</span>
        <span class="text-muted-foreground">disco: {{ sample.disk }}</span>
        <span class="grow" />
        <a :href="sample.download_url" class="inline-flex items-center gap-1 text-primary hover:underline"><IconDownload class="size-3.5" /> Descargar</a>
        <button type="button" class="inline-flex items-center gap-1 text-red-600 hover:underline" @click="deleteSample"><IconTrash class="size-3.5" /> Borrar</button>
      </div>
    </div>

    <div v-if="ran" class="bg-card border border-card-line rounded-card divide-y divide-card-line">
      <div class="px-5 py-3 flex items-center justify-between">
        <p class="text-sm font-semibold text-foreground">Resultados</p>
        <p class="text-xs" :class="summary.failed ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'">
          {{ summary.ok }}/{{ summary.total }} OK<span v-if="summary.failed"> · {{ summary.failed }} fallaron</span><span v-if="summary.skipped"> · {{ summary.skipped }} omitidos</span>
        </p>
      </div>
      <div v-for="r in results" :key="r.id" class="px-5 py-2.5">
        <button type="button" class="w-full flex items-center gap-3 text-left" :disabled="!r.detail" @click="open[r.id] = !open[r.id]">
          <component :is="ICONS[r.status]" class="size-4 shrink-0" :class="COLORS[r.status]" />
          <span class="text-sm text-foreground grow">{{ r.label }}</span>
          <span v-if="r.ms != null" class="text-[11px] text-muted-foreground tabular-nums">{{ r.ms }} ms</span>
        </button>
        <p v-if="r.detail && (open[r.id] || r.status === 'failed')" class="ml-7 mt-1 text-xs break-all" :class="r.status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'">{{ r.detail }}</p>
      </div>
    </div>
  </div>
</template>
