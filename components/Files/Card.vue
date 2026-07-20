<script setup>
import { IconDownload, IconExternalLink, IconTrash } from '@tabler/icons-vue'

/**
 * <FilesCard> — Muestra un File del backend innertia-laravel.
 *
 * Variantes:
 *   - 'card'    (default) — card vertical con icono grande arriba, nombre + meta abajo
 *   - 'row'    — fila horizontal compacta (icono + nombre + acciones a la derecha)
 *   - 'compact' — mini-row con icono pequeño + nombre (sin acciones)
 *
 * El file esperado matchea el shape del modelo File de innertia-laravel:
 *   { id, original_name, mime_type, extension, size, ... }
 *
 * Si el file es una imagen y se pasa `previewImage`, se renderiza el thumbnail
 * usando el viewUrl en lugar del icono.
 */
const props = defineProps({
  file: { type: Object, required: true },

  /** 'card' | 'row' | 'compact' */
  variant: { type: String, default: 'card' },

  /** Mostrar tamaño (formatSize). */
  showSize: { type: Boolean, default: true },

  /** Mostrar extensión (PDF, XLSX, etc.). */
  showType: { type: Boolean, default: true },

  /** Mostrar botón de download. */
  downloadable: { type: Boolean, default: true },

  /** Mostrar botón de ver (abre en nueva pestaña). */
  viewable: { type: Boolean, default: false },

  /** Mostrar botón de eliminar (emite `delete`). */
  deletable: { type: Boolean, default: false },

  /** Si el file es una imagen, renderizar thumbnail en lugar del icono. */
  previewImage: { type: Boolean, default: true },
})

const emit = defineEmits(['click', 'delete'])

const { download, view, fileViewUrl, formatSize, iconFor } = useFile()

const isImage = computed(() => props.file?.mime_type?.startsWith('image/'))

// Thumbnail: view_url firmado del backend (o fallback a la ruta por-id).
const thumbSrc = computed(() => fileViewUrl(props.file))
const showThumb = computed(() => props.previewImage && isImage.value)
const icon = computed(() => iconFor(props.file?.mime_type))

const handleDownload = (e) => {
  e?.stopPropagation?.()
  download(props.file)
}
const handleView = (e) => {
  e?.stopPropagation?.()
  view(props.file)
}
const handleDelete = (e) => {
  e?.stopPropagation?.()
  emit('delete', props.file)
}
</script>

<template>
  <!-- ════════════ Variante 'compact' (mini-row) ════════════ -->
  <div
    v-if="variant === 'compact'"
    class="inline-flex items-center gap-2 px-2 py-1 rounded-control text-xs hover:bg-muted-hover transition-colors cursor-pointer"
    @click="emit('click', file)"
  >
    <component :is="icon" :size="14" class="shrink-0 text-muted-foreground" />
    <span class="truncate text-foreground">{{ file.original_name }}</span>
  </div>

  <!-- ════════════ Variante 'row' (horizontal) ════════════ -->
  <div
    v-else-if="variant === 'row'"
    class="group flex items-center gap-3 px-3 py-2 rounded-card border border-card-line bg-card hover:border-primary/40 hover:bg-muted-hover/30 transition-colors cursor-pointer"
    @click="emit('click', file)"
  >
    <!-- Thumb o icono -->
    <div class="shrink-0">
      <img
        v-if="showThumb"
        :src="thumbSrc"
        :alt="file.original_name"
        class="size-10 rounded-control object-cover bg-muted"
      />
      <div v-else class="size-10 rounded-control bg-muted flex items-center justify-center text-muted-foreground">
        <component :is="icon" :size="20" :stroke="1.75" />
      </div>
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-foreground truncate">{{ file.original_name }}</p>
      <p class="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
        <span v-if="showType && file.extension" class="uppercase">{{ file.extension }}</span>
        <span v-if="showSize">{{ formatSize(file.size) }}</span>
      </p>
    </div>

    <!-- Acciones -->
    <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
      <slot name="actions" :file="file" />
      <button
        v-if="viewable"
        type="button"
        title="Ver"
        class="inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
        @click="handleView"
      >
        <IconExternalLink class="size-3.5" />
      </button>
      <button
        v-if="downloadable"
        type="button"
        title="Descargar"
        class="inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
        @click="handleDownload"
      >
        <IconDownload class="size-3.5" />
      </button>
      <button
        v-if="deletable"
        type="button"
        title="Eliminar"
        class="inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        @click="handleDelete"
      >
        <IconTrash class="size-3.5" />
      </button>
    </div>
  </div>

  <!-- ════════════ Variante 'card' (vertical, default) ════════════ -->
  <div
    v-else
    class="group relative flex flex-col rounded-card border border-card-line bg-card hover:border-primary/40 hover:shadow-sm transition cursor-pointer overflow-hidden"
    @click="emit('click', file)"
  >
    <!-- Header — MISMA proporción (aspect-video) para todas las cards.
         Imagen: thumbnail completo. No-imagen: extensión como tipografía grande
         + ícono superpuesto, así llena visualmente el espacio. -->
    <div class="relative aspect-video overflow-hidden">
      <!-- Imagen real -->
      <img
        v-if="showThumb"
        :src="thumbSrc"
        :alt="file.original_name"
        class="size-full object-cover"
      />
      <!-- No-imagen: bg con gradient + extensión grande como tipografía dominante -->
      <div
        v-else
        class="size-full bg-gradient-to-br from-muted via-muted/60 to-muted/30 flex flex-col items-center justify-center gap-1 text-muted-foreground select-none"
      >
        <component :is="icon" :size="44" :stroke="1.5" class="opacity-70" />
        <span
          v-if="file.extension"
          class="text-2xl font-bold uppercase tracking-widest text-foreground/70"
        >
          {{ file.extension }}
        </span>
      </div>

      <!-- Chip con el tipo en imagen — sirve como label discreto -->
      <span
        v-if="showThumb && showType && file.extension"
        class="absolute top-2 right-2 px-1.5 py-0.5 rounded-badge bg-card/85 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider text-foreground shadow-sm"
      >
        {{ file.extension }}
      </span>
    </div>

    <!-- Info -->
    <div class="p-3 space-y-0.5">
      <p class="text-sm font-medium text-foreground truncate">{{ file.original_name }}</p>
      <p v-if="showSize" class="text-xs text-muted-foreground">{{ formatSize(file.size) }}</p>
    </div>

    <!-- Acciones — overlay arriba a la derecha en hover -->
    <div class="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm rounded-control p-0.5">
      <slot name="actions" :file="file" />
      <button
        v-if="viewable"
        type="button"
        title="Ver"
        class="inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
        @click="handleView"
      >
        <IconExternalLink class="size-3.5" />
      </button>
      <button
        v-if="downloadable"
        type="button"
        title="Descargar"
        class="inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
        @click="handleDownload"
      >
        <IconDownload class="size-3.5" />
      </button>
      <button
        v-if="deletable"
        type="button"
        title="Eliminar"
        class="inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        @click="handleDelete"
      >
        <IconTrash class="size-3.5" />
      </button>
    </div>
  </div>
</template>
