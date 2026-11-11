<script setup>
/**
 * <Files.DriveBrowser> — panel para navegar Google Drive (Mi unidad + unidades compartidas).
 *
 *   mode="items"  (default) v-model = DriveEntry[] seleccionados (multiple o single).
 *   mode="folder" solo carpetas; emite `pick` con {id,name} al elegir la carpeta actual.
 *   accept=['image/*'] limita qué archivos se pueden elegir (las carpetas solo se navegan).
 *
 *   <Files.DriveBrowser drive-base="platform" v-model="selection" />
 */
import { IconFolder, IconFile, IconPhoto, IconFileTypePdf, IconFileText, IconTable, IconPresentation, IconChevronRight, IconBrandGoogleDrive, IconUsersGroup, IconFolderPlus, IconCheck } from '@tabler/icons-vue'
import { isSelectable, toggleSelection } from '../../composables/useDriveBrowser/internal/browser'

const props = defineProps({
  driveBase:     { type: String, default: '' },
  mode:          { type: String, default: 'items', validator: v => ['items', 'folder'].includes(v) },
  modelValue:    { type: Array, default: () => [] },
  multiple:      { type: Boolean, default: true },
  accept:        { type: Array, default: () => [] },
  /** Abre el panel en este ítem (id de carpeta) al montar. */
  startAt:       { type: String, default: null },
  allowCreate:   { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue', 'pick'])

const toast = useToast()
const browser = useDriveBrowser(() => ({ base: props.driveBase, foldersOnly: props.mode === 'folder' }))

onMounted(async () => {
  if (!props.startAt) return
  try { await browser.openAt(props.startAt) } catch { /* sin acceso: queda en la raíz */ }
})

const selectedIds = computed(() => new Set(props.modelValue.map(e => e.id)))

function onRow(entry) {
  if (entry.is_folder) {
    browser.enter(entry)
    return
  }
  if (props.mode === 'items' && isSelectable(entry, props.accept)) {
    emit('update:modelValue', toggleSelection(props.modelValue, entry, props.multiple))
  }
}

function toggleFolder(entry) {
  if (props.mode === 'items' && isSelectable(entry, props.accept)) {
    emit('update:modelValue', toggleSelection(props.modelValue, entry, props.multiple))
  }
}

const creating = ref(false)
const newName = ref('')
async function createFolder() {
  const name = newName.value.trim()
  if (!name) return
  try {
    await browser.createFolder.mutateAsync(name)
    newName.value = ''
    creating.value = false
  } catch (e) {
    toast.error(e?.data?.message ?? 'No se pudo crear la carpeta.')
  }
}

function iconFor(entry) {
  if (entry.is_folder) return IconFolder
  const m = entry.mime_type ?? ''
  if (m.startsWith('image/')) return IconPhoto
  if (m === 'application/pdf') return IconFileTypePdf
  if (m.includes('spreadsheet')) return IconTable
  if (m.includes('presentation')) return IconPresentation
  if (m.includes('document') || m.startsWith('text/')) return IconFileText
  return IconFile
}
</script>

<template>
  <div class="space-y-3">
    <!-- Unidades -->
    <div class="flex flex-wrap gap-1.5">
      <button type="button" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control border text-xs transition-colors"
        :class="!browser.location.value.drive ? 'border-primary bg-primary/5 text-primary' : 'border-card-line text-muted-foreground hover:border-primary/50'"
        @click="browser.selectDrive(null)">
        <IconBrandGoogleDrive class="size-3.5" /> Mi unidad
      </button>
      <button v-for="d in browser.sharedDrives.value" :key="d.id" type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control border text-xs transition-colors"
        :class="browser.location.value.drive?.id === d.id ? 'border-primary bg-primary/5 text-primary' : 'border-card-line text-muted-foreground hover:border-primary/50'"
        @click="browser.selectDrive(d)">
        <IconUsersGroup class="size-3.5" /> {{ d.name }}
      </button>
    </div>

    <!-- Migas -->
    <nav class="flex flex-wrap items-center gap-1 text-sm">
      <template v-for="(c, i) in browser.breadcrumb.value" :key="c.id + i">
        <IconChevronRight v-if="i > 0" class="size-3.5 text-muted-foreground" />
        <button type="button" class="hover:text-primary truncate max-w-48"
          :class="i === browser.breadcrumb.value.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'"
          @click="browser.goTo(i)">{{ c.name }}</button>
      </template>
    </nav>

    <!-- Lista -->
    <div class="rounded-control border border-card-line divide-y divide-card-line max-h-80 overflow-y-auto">
      <p v-if="browser.isLoading.value && !browser.items.value.length" class="p-4 text-sm text-muted-foreground">Cargando…</p>
      <p v-else-if="browser.error.value" class="p-4 text-sm text-red-600 dark:text-red-400">{{ browser.error.value }}</p>
      <p v-else-if="!browser.items.value.length" class="p-4 text-sm text-muted-foreground">{{ mode === 'folder' ? 'Sin subcarpetas.' : 'Carpeta vacía.' }}</p>
      <div v-for="entry in (browser.error.value ? [] : browser.items.value)" :key="entry.id"
        class="flex items-center gap-2 px-3 py-2 text-sm"
        :class="[
          selectedIds.has(entry.id) ? 'bg-primary/5' : 'hover:bg-primary/5',
          !entry.is_folder && mode === 'items' && !isSelectable(entry, accept) ? 'opacity-50' : 'cursor-pointer',
        ]"
        @click="onRow(entry)">
        <button v-if="mode === 'items' && isSelectable(entry, accept)" type="button"
          class="size-4 shrink-0 rounded-control border flex items-center justify-center"
          :class="selectedIds.has(entry.id) ? 'bg-primary border-primary text-white' : 'border-card-line'"
          :aria-label="selectedIds.has(entry.id) ? 'Quitar de la selección' : 'Seleccionar'"
          @click.stop="entry.is_folder ? toggleFolder(entry) : onRow(entry)">
          <IconCheck v-if="selectedIds.has(entry.id)" class="size-3" />
        </button>
        <component :is="iconFor(entry)" class="size-4 shrink-0 text-muted-foreground" />
        <span class="flex-1 truncate text-foreground">{{ entry.name }}</span>
        <span v-if="entry.is_native" class="text-[10px] uppercase tracking-wide text-muted-foreground">Google</span>
        <IconChevronRight v-if="entry.is_folder" class="size-3.5 text-muted-foreground" />
      </div>
    </div>

    <!-- Acciones -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <form v-if="allowCreate && creating" class="flex flex-1 items-center gap-2" @submit.prevent="createFolder">
        <input v-model="newName" autofocus placeholder="Nombre de la carpeta"
          class="flex-1 h-8 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30">
        <AppButton text="Crear" severity="primary" size="sm" :loading="browser.createFolder.isPending.value" @click="createFolder" />
        <AppButton text="Cancelar" severity="secondary" size="sm" @click="creating = false" />
      </form>
      <button v-else-if="allowCreate" type="button" class="inline-flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
        :disabled="!!browser.error.value" @click="creating = true">
        <IconFolderPlus class="size-4" /> Nueva carpeta en “{{ browser.current.value.name }}”
      </button>

      <AppButton v-if="mode === 'folder'" :text="`Usar “${browser.current.value.name}”`" severity="primary" size="sm"
        :disabled="!browser.canPickCurrent.value || !!browser.error.value"
        @click="emit('pick', browser.current.value)" />
      <span v-else-if="modelValue.length" class="text-xs text-muted-foreground">{{ modelValue.length }} seleccionado(s)</span>
    </div>
    <p v-if="mode === 'folder' && !browser.canPickCurrent.value" class="text-[11px] text-muted-foreground">Entra a una carpeta (o crea una) para elegirla.</p>
  </div>
</template>
