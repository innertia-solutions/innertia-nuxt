<script setup>
import {
  IconCloudUpload, IconX, IconCheck, IconAlertCircle, IconLoader2,
  IconPlayerPause, IconRotateClockwise, IconTrash,
} from '@tabler/icons-vue'

/**
 * <FilesUpload> — Zona de upload con drag & drop + cards per file.
 *
 * Estados por archivo: pending → uploading → processing → success | error
 *
 *  - uploading:  el XHR está enviando el binario (0-100% real)
 *  - processing: el cliente terminó (100%) pero el server aún no respondió.
 *                Se muestra como indeterminate hasta resolver.
 *
 * El consumer recibe `@uploaded(file)` por cada archivo exitoso y
 * `@error({ file, error })` por cada fallo. `@complete(results)` al terminar todos.
 */
const props = defineProps({
  endpoint:        { type: String, required: true },
  field:           { type: String, default: 'file' },
  multiple:        { type: Boolean, default: false },
  accept:          { type: String, default: '' },
  maxSizeMb:       { type: Number, default: 0 },
  maxFiles:        { type: Number, default: 0 },
  autoUpload:      { type: Boolean, default: true },
  extraData:       { type: Object, default: () => ({}) },
  clearOnSuccess:  { type: Boolean, default: false },
  hint:            { type: String, default: 'Arrastrá archivos o hacé click para seleccionar' },
  hintSecondary:   { type: String, default: '' },
})

const emit = defineEmits(['uploaded', 'error', 'complete', 'change'])

const { upload, formatSize, iconFor } = useFile()

const inputRef = ref(null)
const dragOver = ref(false)
const queue    = ref([])

let nextId = 1
const newItem = (file) => ({
  id: nextId++,
  file,
  name: file.name,
  size: file.size,
  type: file.type || 'application/octet-stream',
  status: 'pending',     // pending | uploading | processing | success | error
  progress: 0,
  loaded: 0,
  speed: 0,              // bytes/s
  eta: 0,                // segundos restantes
  startedAt: 0,
  response: null,
  error: null,
  controller: null,
})

watch(queue, (q) => emit('change', q), { deep: true })

const maxBytes = computed(() => props.maxSizeMb > 0 ? props.maxSizeMb * 1024 * 1024 : Infinity)
const validate = (file) => file.size > maxBytes.value ? `Excede ${props.maxSizeMb}MB` : null

const openPicker = () => inputRef.value?.click()

const addFiles = (fileList) => {
  const incoming = Array.from(fileList)
  if (!incoming.length) return

  let toAdd = incoming
  if (props.multiple) {
    if (props.maxFiles > 0) {
      const slots = props.maxFiles - queue.value.length
      if (slots <= 0) return
      toAdd = incoming.slice(0, slots)
    }
  } else {
    queue.value = []
    toAdd = [incoming[0]]
  }

  for (const f of toAdd) {
    const item = newItem(f)
    const err  = validate(f)
    if (err) { item.status = 'error'; item.error = err }
    queue.value.push(item)
  }

  if (props.autoUpload) nextTick(uploadAll)
}

const uploadOne = async (item) => {
  if (item.status !== 'pending') return
  item.status     = 'uploading'
  item.startedAt  = Date.now()
  item.controller = new AbortController()
  try {
    const res = await upload(props.endpoint, item.file, {
      field:      props.field,
      extraData:  props.extraData,
      signal:     item.controller.signal,
      onProgress: (p, loaded) => {
        item.progress = p
        item.loaded   = loaded
        const elapsed = (Date.now() - item.startedAt) / 1000
        if (elapsed > 0) {
          item.speed = loaded / elapsed
          if (item.speed > 0) item.eta = Math.max(0, (item.size - loaded) / item.speed)
        }
      },
      onUploaded: () => {
        // Upload del cliente terminó, esperando server.
        if (item.status === 'uploading') {
          item.status   = 'processing'
          item.progress = 100
        }
      },
    })
    item.status   = 'success'
    item.progress = 100
    item.response = res
    emit('uploaded', res, item)
    if (props.clearOnSuccess) setTimeout(() => removeItem(item.id), 800)
  } catch (e) {
    if (e?.aborted) return
    item.status = 'error'
    item.error  = e?.data?.message ?? e.message ?? 'Error en la carga'
    emit('error', { item, error: e })
  }
}

const uploadAll = async () => {
  const pending = queue.value.filter(i => i.status === 'pending')
  if (!pending.length) return
  await Promise.allSettled(pending.map(uploadOne))
  emit('complete', {
    success: queue.value.filter(i => i.status === 'success'),
    failed:  queue.value.filter(i => i.status === 'error'),
  })
}

const retryItem = (item) => {
  item.status   = 'pending'
  item.progress = 0
  item.loaded   = 0
  item.error    = null
  uploadOne(item)
}

const removeItem = (id) => {
  const idx = queue.value.findIndex(i => i.id === id)
  if (idx === -1) return
  const item = queue.value[idx]
  if (item.status === 'uploading' || item.status === 'processing') item.controller?.abort()
  queue.value.splice(idx, 1)
}

const clearAll = () => {
  for (const it of queue.value) {
    if (it.status === 'uploading' || it.status === 'processing') it.controller?.abort()
  }
  queue.value = []
}

const cancelItem = (item) => {
  if (item.status === 'uploading' || item.status === 'processing') {
    item.controller?.abort()
    item.status = 'error'
    item.error  = 'Cancelado'
  }
}

// ── Drag & drop ────────────────────────────────────────────────────────────
const onDragOver  = (e) => { e.preventDefault(); dragOver.value = true }
const onDragLeave = (e) => { e.preventDefault(); dragOver.value = false }
const onDrop      = (e) => {
  e.preventDefault()
  dragOver.value = false
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
}

const onInputChange = (e) => {
  if (e.target?.files?.length) addFiles(e.target.files)
  e.target.value = ''
}

// ── Helpers de UI ──────────────────────────────────────────────────────────
const formatSpeed = (bps) => {
  if (!bps || bps < 1) return ''
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
}
const formatEta = (s) => {
  if (!s || !isFinite(s) || s < 1) return ''
  if (s < 60) return `${Math.ceil(s)}s`
  return `${Math.ceil(s / 60)}m`
}

const summary = computed(() => {
  const total = queue.value.length
  const ok    = queue.value.filter(i => i.status === 'success').length
  const err   = queue.value.filter(i => i.status === 'error').length
  const active = queue.value.filter(i => i.status === 'uploading' || i.status === 'processing').length
  return { total, ok, err, active }
})

defineExpose({ open: openPicker, uploadAll, clearAll, removeItem, queue })
</script>

<template>
  <div class="space-y-3">
    <!-- ── Dropzone ────────────────────────────────────────────────────── -->
    <button
      type="button"
      :class="[
        'w-full flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-card border-2 border-dashed transition-colors text-center',
        dragOver
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-card-line hover:border-primary/40 hover:bg-muted-hover/30 text-muted-foreground',
      ]"
      @click="openPicker"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <IconCloudUpload :size="32" :stroke="1.5" />
      <div>
        <p class="text-sm font-medium text-foreground">{{ hint }}</p>
        <p v-if="hintSecondary" class="text-xs text-muted-foreground mt-1">{{ hintSecondary }}</p>
        <p v-else-if="maxSizeMb || accept" class="text-xs text-muted-foreground mt-1">
          <span v-if="accept">{{ accept }}</span>
          <span v-if="accept && maxSizeMb"> · </span>
          <span v-if="maxSizeMb">máx. {{ maxSizeMb }}MB por archivo</span>
        </p>
      </div>

      <input
        ref="inputRef"
        type="file"
        class="hidden"
        :multiple="multiple"
        :accept="accept || undefined"
        @change="onInputChange"
      />
    </button>

    <!-- ── Summary chip ─────────────────────────────────────────────────── -->
    <div v-if="queue.length" class="flex items-center justify-between text-xs">
      <div class="flex items-center gap-3 text-muted-foreground">
        <span>{{ summary.total }} archivo{{ summary.total === 1 ? '' : 's' }}</span>
        <span v-if="summary.active" class="text-primary inline-flex items-center gap-1">
          <IconLoader2 :size="12" class="animate-spin" /> {{ summary.active }} en progreso
        </span>
        <span v-if="summary.ok"  class="text-emerald-600 dark:text-emerald-400">{{ summary.ok }} ok</span>
        <span v-if="summary.err" class="text-red-500">{{ summary.err }} con error</span>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1 px-2 py-1 rounded-control text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        @click="clearAll"
      >
        <IconTrash :size="12" /> Limpiar
      </button>
    </div>

    <!-- ── Cards per file (estilo Preline file-uploading-progress-form) ── -->
    <TransitionGroup
      v-if="queue.length"
      tag="ul"
      class="space-y-2"
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <li
        v-for="item in queue"
        :key="item.id"
        :class="[
          'relative p-3 rounded-card border bg-card transition-colors',
          item.status === 'error'   ? 'border-red-500/30 bg-red-500/[0.02]'
          : item.status === 'success' ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
          : 'border-card-line',
        ]"
      >
        <div class="flex items-start gap-3">
          <!-- File type icon -->
          <div
            :class="[
              'shrink-0 size-10 rounded-control flex items-center justify-center',
              item.status === 'error'   ? 'bg-red-500/10 text-red-600 dark:text-red-400'
              : item.status === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground',
            ]"
          >
            <component
              :is="item.status === 'success' ? IconCheck
                 : item.status === 'error'   ? IconAlertCircle
                 : iconFor(item.type)"
              :size="20"
              :stroke="1.75"
            />
          </div>

          <!-- Body -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-foreground truncate">{{ item.name }}</p>
                <p class="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                  <template v-if="item.status === 'uploading'">
                    <span>{{ formatSize(item.loaded) }} / {{ formatSize(item.size) }}</span>
                    <span v-if="item.speed" class="mx-1.5">·</span>
                    <span v-if="item.speed">{{ formatSpeed(item.speed) }}</span>
                    <span v-if="item.eta" class="mx-1.5">·</span>
                    <span v-if="item.eta">{{ formatEta(item.eta) }} restantes</span>
                  </template>
                  <template v-else-if="item.status === 'processing'">
                    <span class="text-primary inline-flex items-center gap-1">
                      <IconLoader2 :size="11" class="animate-spin" /> Procesando en el servidor…
                    </span>
                  </template>
                  <template v-else-if="item.status === 'success'">
                    <span class="text-emerald-600 dark:text-emerald-400">Subido</span>
                    <span class="mx-1.5">·</span>
                    <span>{{ formatSize(item.size) }}</span>
                  </template>
                  <template v-else-if="item.status === 'error'">
                    <span class="text-red-500">{{ item.error }}</span>
                  </template>
                  <template v-else>
                    <span>{{ formatSize(item.size) }}</span>
                  </template>
                </p>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-0.5 shrink-0">
                <button
                  v-if="item.status === 'error'"
                  type="button"
                  title="Reintentar"
                  class="inline-flex items-center justify-center size-7 rounded-control text-primary hover:bg-primary/10 transition-colors"
                  @click="retryItem(item)"
                >
                  <IconRotateClockwise class="size-3.5" />
                </button>
                <button
                  v-if="item.status === 'uploading' || item.status === 'processing'"
                  type="button"
                  title="Cancelar"
                  class="inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                  @click="cancelItem(item)"
                >
                  <IconPlayerPause class="size-3.5" />
                </button>
                <button
                  type="button"
                  title="Quitar"
                  class="inline-flex items-center justify-center size-7 rounded-control text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  @click="removeItem(item.id)"
                >
                  <IconX class="size-3.5" />
                </button>
              </div>
            </div>

            <!-- Progress bar (uploading + processing) -->
            <div
              v-if="item.status === 'uploading' || item.status === 'processing'"
              class="mt-2 flex items-center gap-2"
            >
              <div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden relative">
                <!-- Determinate progress -->
                <div
                  v-if="item.status === 'uploading'"
                  class="h-full bg-primary transition-all duration-150"
                  :style="{ width: item.progress + '%' }"
                />
                <!-- Indeterminate shimmer for processing -->
                <div
                  v-else
                  class="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent indeterminate-shimmer"
                />
              </div>
              <span class="text-[11px] font-mono tabular-nums text-muted-foreground w-10 text-right">
                {{ item.status === 'uploading' ? `${item.progress}%` : '…' }}
              </span>
            </div>
          </div>
        </div>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.indeterminate-shimmer {
  animation: shimmer 1.2s ease-in-out infinite;
}
</style>
