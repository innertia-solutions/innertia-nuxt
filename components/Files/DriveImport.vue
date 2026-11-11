<script setup>
/**
 * <Files.DriveImport> — modal autocontenido para importar desde Google Drive al storage.
 * Pasos: elegir → opciones → progreso/resumen. Cerrar no cancela (el proceso sigue en cola);
 * `resume-id` permite reabrir el seguimiento de un import en curso.
 *
 *   <Files.DriveImport v-model="showImport" drive-base="platform" :directory-id="currentDir?.id" @done="refetch" />
 */
import { IconCircleCheck, IconAlertTriangle, IconLoader2, IconChevronDown } from '@tabler/icons-vue'
import { groupItems, itemLabel, isFinished, progressPercent, selectionFlags } from '../../composables/useFileImports/internal/progress'

const props = defineProps({
  modelValue:     { type: Boolean, default: false },
  driveBase:      { type: String, default: '' },
  directoryId:    { type: String, default: null },
  /** Si el producto tiene Directories apagado: avisa y bloquea carpetas. */
  foldersAllowed: { type: Boolean, default: true },
  visibility:     { type: String, default: null },
  resumeId:       { type: String, default: null },
})
const emit = defineEmits(['update:modelValue', 'done'])

const toast = useToast()
const { start, track } = useFileImports(() => props.driveBase)

const step = ref('pick')              // pick | options | progress
const selection = ref([])
const nativeFormat = ref('office')
const importId = ref(null)
const tracker = track(importId)
const current = computed(() => tracker.data.value ?? null)

const flags = computed(() => selectionFlags(selection.value))
const blockedFolders = computed(() => flags.value.hasFolders && !props.foldersAllowed)

watch(() => props.modelValue, (open) => {
  if (!open) return
  if (props.resumeId) {
    importId.value = props.resumeId
    step.value = 'progress'
  } else if (step.value !== 'progress' || isFinished(current.value?.status) || tracker.isError.value) {
    step.value = 'pick'
    selection.value = []
    importId.value = null
  }
}, { immediate: true })

watch(() => current.value?.status, (status) => {
  if (isFinished(status)) emit('done', current.value)
})

function close() { emit('update:modelValue', false) }

async function launch() {
  try {
    const imp = await start.mutateAsync({ items: selection.value, directoryId: props.directoryId, nativeFormat: nativeFormat.value, visibility: props.visibility })
    importId.value = imp.id
    step.value = 'progress'
  } catch (e) {
    toast.error(e?.data?.message ?? 'No se pudo iniciar la importación.')
  }
}

/** Siempre pasa por opciones: muestra el conteo, el formato si hay nativos y el aviso de carpetas. */
function next() {
  step.value = 'options'
}

const percent = computed(() => (current.value ? progressPercent(current.value) : null))
const groups = computed(() => groupItems(current.value?.items ?? []))
const expanded = reactive({})
</script>

<template>
  <ModalForm :model-value="modelValue" title="Importar desde Google Drive" size="lg" @update:model-value="emit('update:modelValue', $event)">
    <!-- 1. Elegir -->
    <div v-if="step === 'pick'" class="space-y-2">
      <p class="text-xs text-muted-foreground">Elige archivos y carpetas. Se copian a este directorio; las carpetas se importan con todo su contenido.</p>
      <FilesDriveBrowser v-model="selection" :drive-base="driveBase" />
    </div>

    <!-- 2. Opciones -->
    <div v-else-if="step === 'options'" class="space-y-4">
      <p class="text-sm text-foreground">{{ selection.length }} elemento(s) seleccionado(s).</p>

      <div v-if="flags.hasNatives" class="space-y-2">
        <p class="text-sm font-medium text-foreground">Documentos de Google (Docs, Sheets, Slides)</p>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="nativeFormat" type="radio" value="office" class="mt-0.5">
          <span><span class="text-foreground">Formato Office</span> <span class="text-muted-foreground">(.docx, .xlsx, .pptx — editables)</span></span>
        </label>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="nativeFormat" type="radio" value="pdf" class="mt-0.5">
          <span><span class="text-foreground">PDF</span> <span class="text-muted-foreground">(foto fiel, no editable)</span></span>
        </label>
        <p class="text-[11px] text-muted-foreground">Formularios, sitios y accesos directos no se importan.</p>
      </div>

      <div v-if="blockedFolders" class="rounded-control border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
        Este explorador no admite carpetas: quita las carpetas de la selección.
      </div>
    </div>

    <!-- 3. Progreso / resumen -->
    <div v-else class="space-y-4">
      <p v-if="!current && tracker.isError.value" class="text-sm text-red-600 dark:text-red-400">{{ tracker.error.value?.data?.message ?? 'No se pudo consultar el estado de la importación.' }}</p>
      <div v-else-if="!current" class="flex items-center gap-2 text-sm text-muted-foreground"><IconLoader2 class="size-4 animate-spin" /> Iniciando…</div>
      <template v-else>
        <div class="flex items-center gap-2 text-sm font-medium"
          :class="current.status === 'failed' ? 'text-red-600 dark:text-red-400' : current.status === 'done' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'">
          <IconLoader2 v-if="!isFinished(current.status)" class="size-4 animate-spin" />
          <IconCircleCheck v-else-if="current.status === 'done'" class="size-4" />
          <IconAlertTriangle v-else class="size-4" />
          {{ current.status === 'done' ? 'Importación terminada' : current.status === 'failed' ? 'La importación falló' : 'Importando… puedes cerrar esta ventana' }}
        </div>
        <p v-if="current.error" class="text-xs text-red-600 dark:text-red-400">{{ current.error }}</p>

        <div v-if="!isFinished(current.status)" class="h-2 rounded-control bg-card-line overflow-hidden">
          <div class="h-full bg-primary transition-all" :class="percent === null ? 'w-1/3 animate-pulse' : ''" :style="percent === null ? {} : { width: `${percent}%` }" />
        </div>

        <div class="grid grid-cols-5 gap-2 text-center">
          <div v-for="k in ['imported', 'updated', 'unchanged', 'skipped', 'failed']" :key="k" class="rounded-control border border-card-line p-2">
            <p class="text-base font-semibold text-foreground">{{ current[k] }}</p>
            <p class="text-[10px] text-muted-foreground">{{ { imported: 'Importados', updated: 'Actualizados', unchanged: 'Sin cambios', skipped: 'Omitidos', failed: 'Con error' }[k] }}</p>
          </div>
        </div>

        <div v-for="g in groups" :key="g.result" class="rounded-control border border-card-line">
          <button type="button" class="w-full flex items-center justify-between px-3 py-2 text-sm text-foreground" @click="expanded[g.result] = !expanded[g.result]">
            <span>{{ g.label }} ({{ g.items.length }})</span>
            <IconChevronDown class="size-4 transition-transform" :class="expanded[g.result] ? 'rotate-180' : ''" />
          </button>
          <ul v-if="expanded[g.result]" class="border-t border-card-line max-h-48 overflow-y-auto divide-y divide-card-line">
            <li v-for="(item, i) in g.items" :key="i" class="px-3 py-1.5 text-xs">
              <p class="text-foreground truncate">{{ itemLabel(item) }}</p>
              <p v-if="item.reason" class="text-muted-foreground">{{ item.reason }}</p>
            </li>
          </ul>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <AppButton v-if="step === 'options'" text="Atrás" severity="secondary" size="sm" @click="step = 'pick'" />
        <span v-else />
        <div class="flex gap-2">
          <AppButton :text="step === 'progress' ? 'Cerrar' : 'Cancelar'" severity="secondary" size="sm" @click="close" />
          <AppButton v-if="step === 'pick'" text="Siguiente" severity="primary" size="sm" :disabled="!selection.length" @click="next" />
          <AppButton v-else-if="step === 'options'" text="Importar" severity="primary" size="sm"
            :disabled="!selection.length || blockedFolders" :loading="start.isPending.value" @click="launch" />
        </div>
      </div>
    </template>
  </ModalForm>
</template>
