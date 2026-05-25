<script setup>
/**
 * <DataPreview> — Panel de preview overlay compartido por Table.Standard y Tree.Standard.
 *
 * Encapsula:
 *   - Panel absoluto a la derecha del container padre (position:relative)
 *   - Resize por drag del handle vertical en el borde izquierdo
 *   - Header con título + acciones + botones (abrir, eliminar, minimizar, cerrar)
 *   - Tabs inferior cuando se pasa `historyEndpoint` (Datos / Bitácora)
 *   - Cache de la fila previewada en sessionStorage cuando `cached`
 *   - Chip flotante (Teleport to body) compartido vía `useDockedPreviews` Pinia store
 *
 * El parent es dueño de `row` (v-model) — DataPreview lo seteoa a null al cerrar.
 * El parent también maneja el click fuera + ESC porque conoce su containerRef.
 *
 * Slots:
 *   - header   ({ row, close }) — título del panel
 *   - actions  ({ row, close }) — botones extra al lado de los built-in
 *   - default  ({ row, close }) — body del preview
 */

import {
  IconExternalLink, IconTrash, IconMinus, IconX, IconMaximize,
} from '@tabler/icons-vue'

const props = defineProps({
  /** Activa el preview (típicamente derivado de !!slots.preview en el parent). */
  enabled:           { type: Boolean, default: false },
  /** Nombre único para cache + dock id. */
  name:              { type: String,  default: 'default' },
  /** Si true, persiste la fila previewada en sessionStorage entre navegaciones. */
  cached:            { type: Boolean, default: false },
  /** URL fija o (row) => url para botón "abrir externa". */
  previewHref:       { type: [String, Function], default: null },
  /** Muestra botón eliminar (emite @delete). */
  previewDeletable:  { type: Boolean, default: false },
  /** Porcentaje inicial de la tabla (0-100). */
  splitRatio:        { type: Number,  default: 55 },
  /** Endpoint del historial. Cuando se pasa, muestra tabs Datos/Bitácora. */
  historyEndpoint:   { type: String,  default: null },
  /** Container ref (HTMLElement) para medir el width al hacer resize. */
  containerRef:      { type: Object,  default: null },
})

const emit = defineEmits(['delete'])

// v-model:row → parent es dueño de la fila activa.
const row = defineModel('row', { default: null })

const previewFromCache = ref(false)
const currentRatio     = ref(props.splitRatio)
const panelRef         = ref(null)
const previewTab       = ref('datos')

const cacheKey = computed(() => `data-preview-${props.name}`)

const resolvedPreviewHref = computed(() => {
  if (!props.previewHref || !row.value) return null
  return typeof props.previewHref === 'function'
    ? props.previewHref(row.value)
    : props.previewHref
})

const hasHistory = computed(() => !!props.historyEndpoint)

// Resetear tab al cambiar de fila + reinit tooltips de Preline
watch(row, async (r) => {
  previewTab.value = 'datos'
  if (r) {
    await nextTick()
    if (typeof window !== 'undefined') window.HSStaticMethods?.autoInit?.(['Tooltip'])
  }
})

// Persistir fila en sessionStorage
watch(row, (r) => {
  if (!props.cached) return
  if (r) sessionStorage.setItem(cacheKey.value, JSON.stringify(r))
  else sessionStorage.removeItem(cacheKey.value)
})

const close = () => { row.value = null }

const startResize = (e) => {
  e.preventDefault()
  const onMove = (ev) => {
    const el = props.containerRef
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = ((ev.clientX - rect.left) / rect.width) * 100
    currentRatio.value = Math.min(80, Math.max(25, ratio))
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// ─── Dock (chip flotante) ─────────────────────────────────────────────────────
const {
  docked,
  dock, undock: undockItem,
  activeDockId, activeDockRect,
  collapseDock,
} = useDockedPreviews()
const route = useRoute()

const minimize = () => {
  if (!row.value) return
  const label    = row.value.name ?? row.value.title ?? row.value.email ?? String(row.value.id)
  const subtitle = row.value.email ?? row.value.description ?? null
  dock({
    id:        `${props.name}-${row.value.id}`,
    label,
    subtitle,
    row:       { ...row.value },
    tableName: props.name,
    route:     route.path,
  })
  close()
}

const floatingItem = computed(() =>
  activeDockId.value
    ? docked.value.find(d => d.id === activeDockId.value && d.tableName === props.name) ?? null
    : null
)

const floatingPanelStyle = computed(() => {
  const rect   = activeDockRect.value
  const panelW = 384
  const bottom = 52
  if (!rect || typeof window === 'undefined') return { bottom: bottom + 'px', right: '16px' }
  const tabCenter = rect.left + rect.width / 2
  let right = window.innerWidth - tabCenter - panelW / 2
  right = Math.max(8, Math.min(right, window.innerWidth - panelW - 8))
  return { bottom: bottom + 'px', right: right + 'px' }
})

const expandToFull = (item) => {
  row.value = item.row
  undockItem(item.id)
}

// Restore from cache on mount
onMounted(async () => {
  if (props.cached && props.enabled) {
    try {
      const raw = sessionStorage.getItem(cacheKey.value)
      if (raw) {
        previewFromCache.value = true
        row.value = JSON.parse(raw)
        await nextTick()
        previewFromCache.value = false
      }
    } catch {}
  }
})

defineExpose({ panelRef })
</script>

<template>
  <!-- Panel overlay (absolute right, dentro del container del parent) -->
  <Transition
    :enter-active-class="previewFromCache ? '' : 'transition ease-out duration-200'"
    :enter-from-class="previewFromCache ? '' : 'opacity-0 translate-x-6'"
    :enter-to-class="previewFromCache ? '' : 'opacity-100 translate-x-0'"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100 translate-x-0"
    leave-to-class="opacity-0 translate-x-6"
  >
    <div
      v-if="row && enabled"
      ref="panelRef"
      class="absolute top-0 right-0 bottom-0 z-30 flex flex-col bg-card border border-card-line rounded-card shadow-xl overflow-hidden"
      :style="{ width: (100 - currentRatio) + '%' }"
    >
      <!-- Resize handle -->
      <div
        class="absolute left-1 top-1/2 -translate-y-1/2 h-12 w-1 cursor-col-resize rounded-full bg-border hover:bg-primary/50 transition-colors z-10"
        @mousedown="startResize"
      />

      <!-- Header -->
      <div class="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-card-line">
        <div class="flex-1 min-w-0">
          <slot name="header" :row="row" :close="close" />
        </div>

        <div class="flex items-center gap-0.5 shrink-0">
          <slot name="actions" :row="row" :close="close" />

          <!-- Abrir externa -->
          <div v-if="resolvedPreviewHref" class="hs-tooltip [--placement:top] inline-block">
            <NuxtLink
              :to="resolvedPreviewHref"
              class="hs-tooltip-toggle inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
            >
              <IconExternalLink class="size-3.5" />
            </NuxtLink>
            <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-tooltip border border-tooltip-line text-xs font-medium text-tooltip-foreground rounded-popover shadow-2xs" role="tooltip">Abrir</span>
          </div>

          <!-- Eliminar -->
          <div v-if="previewDeletable" class="hs-tooltip [--placement:top] inline-block">
            <button
              type="button"
              class="hs-tooltip-toggle inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              @click.stop="emit('delete', row)"
            >
              <IconTrash class="size-3.5" />
            </button>
            <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-tooltip border border-tooltip-line text-xs font-medium text-tooltip-foreground rounded-popover shadow-2xs" role="tooltip">Eliminar</span>
          </div>

          <!-- Minimizar -->
          <div class="hs-tooltip [--placement:top] inline-block">
            <button
              type="button"
              class="hs-tooltip-toggle inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
              @click.stop="minimize"
            >
              <IconMinus class="size-3.5" />
            </button>
            <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-tooltip border border-tooltip-line text-xs font-medium text-tooltip-foreground rounded-popover shadow-2xs" role="tooltip">Minimizar</span>
          </div>

          <!-- Cerrar -->
          <div class="hs-tooltip [--placement:top] inline-block">
            <button
              type="button"
              class="hs-tooltip-toggle inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
              @click.stop="close"
            >
              <IconX class="size-3.5" />
            </button>
            <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-tooltip border border-tooltip-line text-xs font-medium text-tooltip-foreground rounded-popover shadow-2xs" role="tooltip">Cerrar</span>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto min-h-0">
        <slot v-if="previewTab === 'datos'" :row="row" :close="close" />
        <TablePreviewTimeline
          v-else-if="previewTab === 'bitacora' && historyEndpoint"
          :endpoint="historyEndpoint"
        />
      </div>

      <!-- Tabs (cuando hay historyEndpoint) -->
      <div v-if="hasHistory" class="shrink-0 flex border-t border-card-line">
        <button
          type="button"
          @click="previewTab = 'datos'"
          :class="[
            'flex-1 py-2.5 text-xs font-semibold transition-colors border-r border-card-line border-t-2 -mt-px',
            previewTab === 'datos'
              ? 'border-t-card text-foreground'
              : 'border-t-transparent text-muted-foreground hover:text-foreground hover:bg-muted-hover'
          ]"
        >
          Datos
        </button>
        <button
          type="button"
          @click="previewTab = 'bitacora'"
          :class="[
            'flex-1 py-2.5 text-xs font-semibold transition-colors border-t-2 -mt-px',
            previewTab === 'bitacora'
              ? 'border-t-card text-foreground'
              : 'border-t-transparent text-muted-foreground hover:text-foreground hover:bg-muted-hover'
          ]"
        >
          Bitácora
        </button>
      </div>
    </div>
  </Transition>

  <!-- Floating chip (dock minimizado) — siempre teleportado a body -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="floatingItem"
        class="fixed z-[60] w-96 flex flex-col bg-card border border-card-line rounded-t-card shadow-2xl overflow-hidden"
        :style="{ ...floatingPanelStyle, maxHeight: 'min(480px, calc(100vh - 60px))' }"
      >
        <div class="flex items-center gap-2 px-3 py-2.5 border-b border-card-line shrink-0 bg-surface select-none">
          <span class="size-6 rounded-avatar bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
            {{ (floatingItem.label?.[0] ?? '?').toUpperCase() }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-foreground truncate leading-tight">{{ floatingItem.label }}</p>
            <p v-if="floatingItem.subtitle" class="text-xs text-muted-foreground truncate">{{ floatingItem.subtitle }}</p>
          </div>
          <button type="button" title="Expandir" class="inline-flex items-center justify-center size-6 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors" @click.stop="expandToFull(floatingItem)">
            <IconMaximize class="size-3.5" />
          </button>
          <button type="button" title="Minimizar" class="inline-flex items-center justify-center size-6 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors" @click.stop="collapseDock()">
            <IconMinus class="size-3.5" />
          </button>
          <button type="button" title="Cerrar" class="inline-flex items-center justify-center size-6 rounded-control text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" @click.stop="undockItem(floatingItem.id)">
            <IconX class="size-3.5" />
          </button>
        </div>
        <div class="flex-1 overflow-y-auto min-h-0">
          <slot :row="floatingItem.row" :close="() => undockItem(floatingItem.id)" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
