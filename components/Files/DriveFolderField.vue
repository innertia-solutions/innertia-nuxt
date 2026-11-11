<script setup>
/**
 * <Files.DriveFolderField> — campo "carpeta de Google Drive" (v-model = id de carpeta).
 * Muestra nombre + ruta + enlace, y abre <Files.DriveBrowser mode="folder"> en un modal.
 *
 *   <Files.DriveFolderField v-model="form.drive_folder_id" drive-base="platform" />
 */
import { IconBrandGoogleDrive, IconExternalLink, IconX } from '@tabler/icons-vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  driveBase:  { type: String, default: '' },
  title:      { type: String, default: 'Elegir carpeta de Drive' },
})
const emit = defineEmits(['update:modelValue'])

const { info } = useDriveBrowser(() => ({ base: props.driveBase, foldersOnly: true, enabled: false }))
const current = ref(null)   // { item, path }
const error = ref(null)
const open = ref(false)

async function load(id) {
  current.value = null
  error.value = null
  if (!id) return
  try { current.value = await info(id) } catch (e) { error.value = e?.data?.message ?? 'No se pudo leer la carpeta.' }
}
watch(() => props.modelValue, load, { immediate: true })

const pathLabel = computed(() => (current.value?.path ?? []).map(c => c.name).join(' › '))

function onPick(folder) {
  emit('update:modelValue', folder.id)
  open.value = false
}
</script>

<template>
  <div>
    <div class="flex items-center gap-2 rounded-control border border-card-line bg-card px-3 min-h-9 py-1.5">
      <IconBrandGoogleDrive class="size-4 shrink-0 text-muted-foreground" />
      <div class="flex-1 min-w-0 text-sm">
        <span v-if="!modelValue" class="text-muted-foreground">Sin carpeta elegida</span>
        <template v-else-if="current">
          <p class="text-foreground truncate font-medium">{{ current.item.name }}</p>
          <p v-if="pathLabel" class="text-[11px] text-muted-foreground truncate">{{ pathLabel }}</p>
        </template>
        <template v-else-if="error">
          <p class="text-foreground truncate font-mono text-xs">{{ modelValue }}</p>
          <p class="text-[11px] text-red-600 dark:text-red-400 truncate">{{ error }}</p>
        </template>
        <span v-else class="text-muted-foreground">Cargando…</span>
      </div>
      <a v-if="current?.item?.web_url" :href="current.item.web_url" target="_blank" rel="noopener" class="text-muted-foreground hover:text-primary" title="Abrir en Drive">
        <IconExternalLink class="size-4" />
      </a>
      <button v-if="modelValue" type="button" class="text-muted-foreground hover:text-red-600" title="Quitar" @click="emit('update:modelValue', '')">
        <IconX class="size-4" />
      </button>
      <AppButton :text="modelValue ? 'Cambiar' : 'Elegir carpeta'" severity="secondary" size="sm" @click="open = true" />
    </div>

    <ModalForm v-model="open" :title="title" size="lg">
      <FilesDriveBrowser v-if="open" mode="folder" :drive-base="driveBase" :start-at="modelValue || null" @pick="onPick" />
      <template #footer>
        <AppButton text="Cerrar" severity="secondary" size="sm" @click="open = false" />
      </template>
    </ModalForm>
  </div>
</template>
