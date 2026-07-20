<script setup>
import { IconDownload, IconExternalLink, IconFileX, IconLoader2 } from '@tabler/icons-vue'

/**
 * <FilesPreview> — Previsualizador universal de archivos. Detecta el tipo
 * automáticamente y dispatcha al viewer correspondiente.
 *
 * Soporta sin deps:
 *   - PDF (iframe nativo del browser)
 *   - Imágenes (jpg, png, gif, webp, svg, etc.)
 *   - Video / Audio
 *   - Texto plano, JSON, código fuente
 *   - Markdown (parser inline sin deps)
 *   - CSV / TSV (tabla nativa)
 *
 * Soporta con import dinámico (consumer debe instalar la dep):
 *   - .xlsx / .xls → `xlsx` (SheetJS)
 *   - .docx        → `mammoth`
 *
 * Para cualquier otro tipo: fallback con metadata + botón de descarga.
 *
 * Sigue los tokens del DS: bordered, padding, size, rounded-card, border-card-line.
 */

const props = defineProps({
  /** File del backend innertia-laravel: { id, original_name, mime_type, extension, size } */
  file:        { type: Object, required: true },

  /** 'sm' | 'md' | 'lg' (default) | 'fit' — controla min/max-height del body
   *  Default 'lg' porque previsualizar archivos (PDF, docx, etc.) necesita altura */
  size:        { type: String,  default: 'lg' },

  /** Wrapper con border + rounded-card. */
  bordered:    { type: Boolean, default: true },

  /** Muestra toolbar superior con filename + botones (download / abrir). */
  showToolbar: { type: Boolean, default: true },
})

const { fileViewUrl, download, view, formatSize, iconFor } = useFile()

const fileIcon = computed(() => iconFor(props.file?.mime_type))

// URL de serving preferida: el view_url FIRMADO del backend (dominio propio, la
// firma es la credencial → sirve en <img>/<iframe>/fetch sin Bearer ni cookie).
// Cae a la ruta por-id solo si el resource no trajo la URL firmada.
const src = computed(() => fileViewUrl(props.file))

// ─── Tipo de viewer ──────────────────────────────────────────────────────────
const viewerType = computed(() => {
  const mime = (props.file?.mime_type || '').toLowerCase()
  const ext  = (props.file?.extension  || '').toLowerCase()

  if (mime.startsWith('image/'))  return 'image'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('video/'))  return 'video'
  if (mime.startsWith('audio/'))  return 'audio'

  if (mime === 'application/json' || ext === 'json') return 'json'
  if (mime === 'text/markdown' || ['md', 'markdown'].includes(ext)) return 'markdown'
  if (mime === 'text/csv' || ['csv', 'tsv'].includes(ext)) return 'csv'

  // Office por EXTENSIÓN antes del check de text/*: un .xls/.xlsx/.doc/.docx
  // suele llegar con mime mal detectado (p.ej. text/plain u octet-stream) y aun
  // así debe usar el renderer rico (Excel con pestañas / docx), no el de texto.
  if (['xlsx', 'xls'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) return 'xlsx'
  if (['docx', 'doc'].includes(ext) || mime.includes('wordprocessing') || mime.includes('msword')) return 'docx'

  if (mime.startsWith('text/') || ['log','yml','yaml','env','sh','js','ts','tsx','jsx','css','html','xml','php','py','rb','go','rs','java','sql','toml','ini'].includes(ext)) return 'text'

  return 'unknown'
})

// ─── Sizes — altura fija basada en vh para que el iframe/video tengan altura
// concreta del parent y no colapsen por flex sizing.
const sizeStyle = computed(() => {
  switch (props.size) {
    case 'sm':  return { height: '32rem' }   // ~512px fijo
    case 'lg':  return { height: '85vh' }    // 85% del viewport
    case 'fit': return {}
    case 'md':
    default:    return { height: '60vh' }    // 60% del viewport
  }
})

// ─── Carga de contenido según tipo ───────────────────────────────────────────
const textContent  = ref(null)
const textError    = ref(null)
const isLoadingTxt = ref(false)

const xlsxWorkbook  = ref(null)   // { sheets: [{ name, header, rows }], hasImages: bool }
const xlsxActiveIdx = ref(0)
const xlsxError     = ref(null)
const isLoadingXlsx = ref(false)

const docxHtml      = ref(null)
const docxError     = ref(null)
const isLoadingDocx = ref(false)

const fetchText = async () => {
  if (!['markdown', 'csv', 'json', 'text'].includes(viewerType.value)) return
  isLoadingTxt.value = true
  textError.value = null
  try {
    const res = await fetch(src.value)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    textContent.value = await res.text()
  } catch (e) {
    textError.value = e.message
  } finally {
    isLoadingTxt.value = false
  }
}

/** Helper para módulos CJS lazy-importados.
 *  Vite expone CJS como `{ default: exports }` pero también auto-spreads
 *  top-level keys cuando puede. Buscamos en este orden:
 *    1. mod.<fn> (top-level, ESM puro o spread bueno)
 *    2. mod.default.<fn> (CJS clásico via interop)
 *    3. mod.default (puede ser el módulo mismo, no las funciones)
 */
function pickModule(mod, sentinel) {
  if (!mod) return null
  if (typeof mod[sentinel] === 'function') return mod
  if (mod.default && typeof mod.default[sentinel] === 'function') return mod.default
  if (mod.default?.default && typeof mod.default.default[sentinel] === 'function') return mod.default.default
  return null
}

/** Convierte un índice de columna 0-based a letra Excel (0=A, 25=Z, 26=AA, ...). */
function colLetter(idx) {
  let s = ''
  let n = idx + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Buffer/Uint8Array → data URL para renderizar imágenes embebidas en <img>. */
function bufferToDataUrl(buf, ext) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  const base64 = btoa(binary)
  const mime = ext === 'png'  ? 'image/png'
             : ext === 'gif'  ? 'image/gif'
             : ext === 'svg'  ? 'image/svg+xml'
             : ext === 'webp' ? 'image/webp'
             : 'image/jpeg'
  return `data:${mime};base64,${base64}`
}

/** Renderiza una celda a string display + alineación, manejando todos los tipos
 *  que ExcelJS puede entregar: number, string, Date, formula{result}, richText, hyperlink, etc. */
function renderCell(cell) {
  const val = cell?.value
  if (val == null || val === '') return { v: '', align: 'left', t: 'empty' }

  if (typeof val === 'number') {
    return { v: cell.text || String(val), align: 'right', t: 'number' }
  }
  if (val instanceof Date) {
    return { v: cell.text || val.toLocaleDateString('es-CL'), align: 'right', t: 'date' }
  }
  if (typeof val === 'boolean') {
    return { v: val ? 'TRUE' : 'FALSE', align: 'center', t: 'bool' }
  }
  if (typeof val === 'object') {
    if (val.formula !== undefined) {
      const r = val.result
      if (r == null) return { v: '', align: 'left', t: 'formula' }
      if (typeof r === 'number') return { v: cell.text || String(r), align: 'right', t: 'formula' }
      if (r instanceof Date)      return { v: cell.text || r.toLocaleDateString('es-CL'), align: 'right', t: 'formula' }
      return { v: String(r), align: 'left', t: 'formula' }
    }
    if (Array.isArray(val.richText)) {
      return { v: val.richText.map(rt => rt.text).join(''), align: 'left', t: 'rich' }
    }
    if (val.text != null) {
      // Hyperlink: { text, hyperlink }
      return { v: String(val.text), align: 'left', t: 'link' }
    }
    if (val.error) return { v: val.error, align: 'left', t: 'error' }
  }
  return { v: String(val), align: 'left', t: 'string' }
}

/** Letras Excel ('A','AB',...) → índice 0-based. */
function letterToIdx(letters) {
  let n = 0
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64)
  return n - 1
}

/** Parsea worksheet.model.merges ('A1:B2', ...) → { anchors, skip }
 *  - anchors[address] = { colSpan, rowSpan } para la celda top-left del merge
 *  - skip = Set de addresses que deben NO renderearse (cubiertas por un merge) */
function parseMerges(ws) {
  const anchors = {}
  const skip = new Set()
  const merges = ws.model?.merges || []
  for (const m of merges) {
    const match = m.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
    if (!match) continue
    const sCol = letterToIdx(match[1])
    const sRow = parseInt(match[2], 10)
    const eCol = letterToIdx(match[3])
    const eRow = parseInt(match[4], 10)
    const anchor = colLetter(sCol) + sRow
    anchors[anchor] = { colSpan: eCol - sCol + 1, rowSpan: eRow - sRow + 1 }
    for (let r = sRow; r <= eRow; r++) {
      for (let c = sCol; c <= eCol; c++) {
        const addr = colLetter(c) + r
        if (addr !== anchor) skip.add(addr)
      }
    }
  }
  return { anchors, skip }
}

/** Construye una sheet con grilla + imágenes embebidas + merged cells. */
function buildSheet(ws, workbook) {
  const colCount = Math.max(ws.actualColumnCount, ws.columnCount, 0)
  const rowCount = Math.max(ws.actualRowCount, ws.rowCount, 0)

  const cols = []
  for (let c = 0; c < colCount; c++) cols.push(colLetter(c))

  const { anchors, skip } = parseMerges(ws)

  const rows = []
  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r)
    const rowData = []
    for (let c = 1; c <= colCount; c++) {
      const address = colLetter(c - 1) + r
      // Celdas cubiertas por un merge (que no son la top-left) se marcan para skip
      if (skip.has(address)) {
        rowData.push({ skip: true, address })
        continue
      }
      const cell = row.getCell(c)
      const rendered = renderCell(cell)
      rendered.address = address
      if (anchors[address]) {
        rendered.colSpan = anchors[address].colSpan
        rendered.rowSpan = anchors[address].rowSpan
      }
      rowData.push(rendered)
    }
    rows.push(rowData)
  }

  // Imágenes embebidas — ExcelJS expone getImages() + workbook.model.media
  const imageMap = {}
  const images = (typeof ws.getImages === 'function' ? ws.getImages() : []) || []
  for (const img of images) {
    const media = workbook.model.media?.find(m => String(m.index) === String(img.imageId))
    if (!media || !media.buffer) continue
    const dataUrl = bufferToDataUrl(media.buffer, media.extension)
    const tlCol = Math.floor(img.range?.tl?.col ?? 0)
    const tlRow = Math.floor(img.range?.tl?.row ?? 0)
    const address = colLetter(tlCol) + (tlRow + 1)
    if (!imageMap[address]) imageMap[address] = []
    imageMap[address].push({ dataUrl, name: media.name })
  }

  return { name: ws.name, cols, rows, firstRow: 1, imageMap }
}

const loadXlsx = async () => {
  if (viewerType.value !== 'xlsx') return
  isLoadingXlsx.value = true
  xlsxError.value = null
  xlsxActiveIdx.value = 0
  try {
    const mod = await import('exceljs').catch(() => null)
    const ExcelJS = pickModule(mod, 'Workbook')
                  ?? (mod?.default?.Workbook ? mod.default : null)
                  ?? mod
    if (!ExcelJS?.Workbook) {
      console.warn('[FilesPreview] exceljs module shape:', mod)
      throw new Error('Para previsualizar .xlsx instalá la dep: pnpm add exceljs')
    }
    const res = await fetch(src.value)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const sheets = wb.worksheets.map(ws => buildSheet(ws, wb))
    xlsxWorkbook.value = { sheets }
  } catch (e) {
    console.error('[FilesPreview] xlsx error', e)
    xlsxError.value = e.message
  } finally {
    isLoadingXlsx.value = false
  }
}

const xlsxActiveSheet = computed(() => xlsxWorkbook.value?.sheets?.[xlsxActiveIdx.value] ?? null)

const loadDocx = async () => {
  if (viewerType.value !== 'docx') return
  isLoadingDocx.value = true
  docxError.value = null
  try {
    const mod = await import('mammoth').catch(() => null)
    const mammoth = pickModule(mod, 'convertToHtml')
    if (!mammoth) {
      console.warn('[FilesPreview] mammoth module shape:', mod)
      throw new Error('Para previsualizar .docx instalá la dep: pnpm add mammoth')
    }
    const res = await fetch(src.value)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer: buf })
    docxHtml.value = result.value
  } catch (e) {
    docxError.value = e.message
  } finally {
    isLoadingDocx.value = false
  }
}

watch(() => props.file?.id, () => {
  textContent.value   = null
  xlsxWorkbook.value  = null
  xlsxActiveIdx.value = 0
  docxHtml.value      = null
  textError.value     = null
  xlsxError.value     = null
  docxError.value     = null
  fetchText()
  loadXlsx()
  loadDocx()
}, { immediate: true })

// ─── Markdown parser inline ──────────────────────────────────────────────────
function renderMarkdown(md) {
  if (!md) return ''
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Fenced code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) =>
    `<pre class="bg-muted rounded-control p-3 overflow-x-auto my-3"><code class="text-xs font-mono text-foreground">${code.trim()}</code></pre>`
  )

  // Headers
  html = html.replace(/^### (.*$)/gm, '<h3 class="text-base font-semibold text-foreground mt-5 mb-2">$1</h3>')
  html = html.replace(/^## (.*$)/gm, '<h2 class="text-lg font-semibold text-foreground mt-6 mb-3">$1</h2>')
  html = html.replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold text-foreground mt-6 mb-3">$1</h1>')

  // Bold + italic (orden importa)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
  html = html.replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, '<em>$1</em>')

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code class="bg-muted text-foreground rounded text-[0.85em] font-mono px-1 py-0.5">$1</code>')

  // Images (antes que links)
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" class="max-w-full rounded-card my-3" />')
  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-primary underline hover:text-primary-hover">$1</a>')

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="my-5 border-card-line" />')

  // Lists (linewise)
  html = html.replace(/^(?:- |\* |\+ )(.*$)/gm, '<li class="list-disc ml-5 my-1">$1</li>')
  html = html.replace(/^\d+\. (.*$)/gm, '<li class="list-decimal ml-5 my-1">$1</li>')

  // Blockquotes
  html = html.replace(/^> (.*$)/gm, '<blockquote class="border-l-2 border-card-line pl-3 text-muted-foreground italic my-2">$1</blockquote>')

  // Paragraphs (split por dobles saltos)
  html = html.split(/\n{2,}/).map(p => {
    p = p.trim()
    if (!p) return ''
    if (/^<(h\d|pre|li|blockquote|hr|img)/i.test(p)) return p
    return `<p class="my-2 text-foreground leading-relaxed">${p.replace(/\n/g, '<br>')}</p>`
  }).join('\n')

  return html
}

const markdownHtml = computed(() => renderMarkdown(textContent.value ?? ''))

// ─── CSV parser ──────────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }
        else inQuotes = false
      } else cell += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(cell); cell = '' }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
      else if (c === '\r') continue
      else cell += c
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const csvRows   = computed(() => textContent.value ? parseCsv(textContent.value) : [])
const csvHeader = computed(() => csvRows.value[0] ?? [])
const csvBody   = computed(() => csvRows.value.slice(1))

// ─── JSON pretty ─────────────────────────────────────────────────────────────
const jsonPretty = computed(() => {
  if (!textContent.value) return ''
  try { return JSON.stringify(JSON.parse(textContent.value), null, 2) }
  catch { return textContent.value }
})
</script>

<template>
  <div
    :class="[
      'flex flex-col bg-card',
      bordered ? 'border border-card-line rounded-card overflow-hidden' : '',
    ]"
    :style="sizeStyle"
  >
    <!-- Toolbar superior -->
    <div
      v-if="showToolbar"
      :class="[
        'shrink-0 flex items-center gap-3 px-4 py-3 bg-card',
        bordered ? 'border-b border-card-line' : '',
      ]"
    >
      <component :is="fileIcon" :size="20" :stroke="1.75" class="shrink-0 text-muted-foreground" />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-foreground truncate">{{ file.original_name }}</p>
        <p class="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
          <span v-if="file.extension" class="uppercase font-medium">{{ file.extension }}</span>
          <span v-if="file.size">{{ formatSize(file.size) }}</span>
        </p>
      </div>
      <button
        type="button"
        title="Abrir en pestaña nueva"
        class="inline-flex items-center justify-center size-8 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
        @click="view(file)"
      >
        <IconExternalLink class="size-4" />
      </button>
      <button
        type="button"
        title="Descargar"
        class="inline-flex items-center justify-center size-8 rounded-control text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors"
        @click="download(file)"
      >
        <IconDownload class="size-4" />
      </button>
    </div>

    <!-- Body — varía por tipo. `relative` para que iframe/video/img puedan
         hacer absolute-fill sin depender del flex sizing del padre. -->
    <div class="flex-1 min-h-0 overflow-auto relative">

      <!-- PDF — absolute fill (iframe + flex sizing es problemático)
           Params: navpanes=0 oculta el sidebar de thumbnails (Chrome/Chromium).
                   view=FitH ajusta al ancho. -->
      <iframe
        v-if="viewerType === 'pdf'"
        :src="`${src}#navpanes=0&view=FitH`"
        class="absolute inset-0 w-full h-full border-0"
        :title="file.original_name"
      />

      <!-- Image -->
      <div v-else-if="viewerType === 'image'" class="absolute inset-0 flex items-center justify-center bg-muted/30 p-4">
        <img :src="src" :alt="file.original_name" class="max-w-full max-h-full object-contain rounded-control shadow-sm" />
      </div>

      <!-- Video -->
      <video
        v-else-if="viewerType === 'video'"
        :src="src"
        controls
        class="absolute inset-0 w-full h-full bg-black"
      />

      <!-- Audio -->
      <div v-else-if="viewerType === 'audio'" class="size-full flex items-center justify-center p-8 bg-muted/20">
        <audio :src="src" controls class="w-full max-w-md" />
      </div>

      <!-- Markdown -->
      <div v-else-if="viewerType === 'markdown'" class="p-5">
        <div v-if="isLoadingTxt" class="text-sm text-muted-foreground inline-flex items-center gap-2"><IconLoader2 class="size-4 animate-spin" /> Cargando…</div>
        <p v-else-if="textError" class="text-sm text-red-500">No se pudo cargar: {{ textError }}</p>
        <div v-else class="max-w-none" v-html="markdownHtml" />
      </div>

      <!-- JSON -->
      <div v-else-if="viewerType === 'json'" class="p-3">
        <div v-if="isLoadingTxt" class="text-sm text-muted-foreground inline-flex items-center gap-2"><IconLoader2 class="size-4 animate-spin" /> Cargando…</div>
        <p v-else-if="textError" class="text-sm text-red-500">No se pudo cargar: {{ textError }}</p>
        <pre v-else class="text-xs font-mono text-foreground whitespace-pre-wrap break-words bg-muted/30 rounded-control p-3">{{ jsonPretty }}</pre>
      </div>

      <!-- Plain text / code -->
      <div v-else-if="viewerType === 'text'" class="p-3">
        <div v-if="isLoadingTxt" class="text-sm text-muted-foreground inline-flex items-center gap-2"><IconLoader2 class="size-4 animate-spin" /> Cargando…</div>
        <p v-else-if="textError" class="text-sm text-red-500">No se pudo cargar: {{ textError }}</p>
        <pre v-else class="text-xs font-mono text-foreground whitespace-pre-wrap break-words bg-muted/30 rounded-control p-3">{{ textContent }}</pre>
      </div>

      <!-- CSV -->
      <div v-else-if="viewerType === 'csv'" class="overflow-auto">
        <div v-if="isLoadingTxt" class="p-3 text-sm text-muted-foreground inline-flex items-center gap-2"><IconLoader2 class="size-4 animate-spin" /> Cargando…</div>
        <p v-else-if="textError" class="p-3 text-sm text-red-500">No se pudo cargar: {{ textError }}</p>
        <table v-else class="text-xs font-mono w-full">
          <thead class="sticky top-0 bg-card border-b-2 border-card-line z-10">
            <tr>
              <th v-for="(h, i) in csvHeader" :key="i" class="text-left px-3 py-2 font-semibold text-foreground whitespace-nowrap">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in csvBody" :key="ri" class="border-b border-card-line hover:bg-muted-hover/30">
              <td v-for="(cell, ci) in row" :key="ci" class="px-3 py-1.5 text-muted-foreground-1 whitespace-nowrap">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- XLSX — custom renderer con tabs, row/col headers, type-aware -->
      <div v-else-if="viewerType === 'xlsx'" class="absolute inset-0 flex flex-col">
        <div v-if="isLoadingXlsx" class="p-3 text-sm text-muted-foreground inline-flex items-center gap-2">
          <IconLoader2 class="size-4 animate-spin" /> Procesando hoja de cálculo…
        </div>
        <p v-else-if="xlsxError" class="p-3 text-sm text-red-500">{{ xlsxError }}</p>

        <template v-else-if="xlsxActiveSheet">
          <!-- Grid -->
          <div class="flex-1 min-h-0 overflow-auto bg-card">
            <table class="border-collapse text-[11px] font-mono">
              <thead class="sticky top-0 z-20">
                <tr>
                  <!-- corner -->
                  <th class="sticky left-0 z-30 w-10 h-7 bg-muted border-b border-r border-card-line" />
                  <!-- column letters A, B, C, ... -->
                  <th
                    v-for="col in xlsxActiveSheet.cols"
                    :key="col"
                    class="min-w-[6rem] h-7 px-2 bg-muted text-muted-foreground font-semibold text-center border-b border-r border-card-line"
                  >
                    {{ col }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, ri) in xlsxActiveSheet.rows"
                  :key="ri"
                  class="hover:bg-muted/30"
                >
                  <!-- row number sticky a la izquierda -->
                  <th class="sticky left-0 z-10 w-10 bg-muted text-muted-foreground font-semibold text-center border-b border-r border-card-line align-middle">
                    {{ xlsxActiveSheet.firstRow + ri }}
                  </th>
                  <template v-for="(cell, ci) in row" :key="ci">
                    <td
                      v-if="!cell.skip"
                      :colspan="cell.colSpan || null"
                      :rowspan="cell.rowSpan || null"
                      class="px-2 border-b border-r border-card-line text-foreground whitespace-nowrap align-middle"
                      :class="{
                        'text-right': cell.align === 'right',
                        'text-center': cell.align === 'center',
                        'text-left': cell.align === 'left',
                        'text-muted-foreground-2 italic': cell.t === 'error',
                        'text-primary underline': cell.t === 'link',
                        'h-auto py-1': xlsxActiveSheet.imageMap[cell.address],
                        'bg-muted/20': cell.colSpan > 1 || cell.rowSpan > 1,
                      }"
                      :style="!xlsxActiveSheet.imageMap[cell.address] ? { height: '1.75rem' } : {}"
                    >
                      <!-- Imágenes embebidas en la celda -->
                      <div v-if="xlsxActiveSheet.imageMap[cell.address]" class="flex flex-col gap-1">
                        <img
                          v-for="(img, ii) in xlsxActiveSheet.imageMap[cell.address]"
                          :key="ii"
                          :src="img.dataUrl"
                          :alt="img.name"
                          class="max-w-[240px] max-h-[160px] object-contain rounded-control border border-card-line bg-card"
                        />
                        <span v-if="cell.v" class="text-[10px] text-muted-foreground">{{ cell.v }}</span>
                      </div>
                      <template v-else>{{ cell.v }}</template>
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tabs de hojas — abajo, estilo Excel -->
          <div
            v-if="xlsxWorkbook && xlsxWorkbook.sheets.length > 1"
            class="shrink-0 flex items-center gap-0.5 px-2 py-1.5 bg-muted border-t border-card-line overflow-x-auto"
          >
            <button
              v-for="(sheet, idx) in xlsxWorkbook.sheets"
              :key="sheet.name"
              type="button"
              @click="xlsxActiveIdx = idx"
              :class="[
                'px-3 py-1 text-xs font-medium rounded-control transition-colors whitespace-nowrap',
                xlsxActiveIdx === idx
                  ? 'bg-card text-foreground shadow-sm border border-card-line'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
              ]"
            >
              {{ sheet.name }}
            </button>
          </div>
        </template>
      </div>

      <!-- DOCX -->
      <div v-else-if="viewerType === 'docx'" class="p-5">
        <div v-if="isLoadingDocx" class="text-sm text-muted-foreground inline-flex items-center gap-2"><IconLoader2 class="size-4 animate-spin" /> Procesando documento…</div>
        <p v-else-if="docxError" class="text-sm text-red-500">{{ docxError }}</p>
        <div v-else class="docx-preview max-w-none text-foreground" v-html="docxHtml" />
      </div>

      <!-- Fallback -->
      <div v-else class="size-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div class="size-16 rounded-card bg-muted flex items-center justify-center text-muted-foreground">
          <IconFileX :size="32" :stroke="1.25" />
        </div>
        <div>
          <p class="text-sm font-medium text-foreground">Vista previa no disponible</p>
          <p class="text-xs text-muted-foreground mt-1">No tenemos un visor para este tipo de archivo.</p>
          <p v-if="file.extension || file.mime_type" class="text-[10px] text-muted-foreground-2 mt-1 font-mono">{{ file.extension }} · {{ file.mime_type }}</p>
        </div>
        <button
          type="button"
          @click="download(file)"
          class="px-3 py-1.5 text-xs font-medium rounded-control bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-1.5"
        >
          <IconDownload :size="14" /> Descargar
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Estilos del HTML inyectado por mammoth (docx). xlsx ahora usa renderer custom. */
.docx-preview :deep(h1) { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.75rem; }
.docx-preview :deep(h2) { font-size: 1.25rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
.docx-preview :deep(h3) { font-size: 1.1rem; font-weight: 600; margin: 1rem 0 0.5rem; }
.docx-preview :deep(p)  { margin: 0.5rem 0; line-height: 1.6; }
.docx-preview :deep(ul),
.docx-preview :deep(ol) { margin: 0.5rem 0 0.5rem 1.5rem; }
.docx-preview :deep(li) { margin: 0.25rem 0; }
.docx-preview :deep(strong) { font-weight: 600; }
.docx-preview :deep(a) { color: var(--color-primary); text-decoration: underline; }
.docx-preview :deep(table) { border-collapse: collapse; margin: 0.75rem 0; }
.docx-preview :deep(td), .docx-preview :deep(th) {
  border: 1px solid var(--color-card-line);
  padding: 4px 8px;
}
</style>
