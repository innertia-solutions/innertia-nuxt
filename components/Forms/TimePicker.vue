<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { IconClock, IconX } from '@tabler/icons-vue'

/*
 * TimePicker — selector de hora estilo Preline (dropdown con columnas), construido
 * con los tokens del design system del lib. Sin dependencias externas.
 *
 * Valor (v-model): SIEMPRE 24h. "HH:mm" por defecto; "HH:mm:ss" si `seconds`.
 * El display puede ser 12h (AM/PM) si `hour12`, pero el valor guardado sigue en 24h.
 */

const props = defineProps({
  hour12:      { type: Boolean, default: false },
  seconds:     { type: Boolean, default: false },
  step:        { type: Number,  default: 1 },      // incremento de la columna de minutos
  minTime:     { type: String,  default: null },   // "HH:mm[:ss]" 24h
  maxTime:     { type: String,  default: null },
  placeholder: { type: String,  default: 'Seleccionar hora' },
  disabled:    { type: Boolean, default: false },
  clearable:   { type: Boolean, default: true },
  label:       { type: String,  default: '' },
  error:       { type: String,  default: null },
  hint:        { type: String,  default: '' },
  size:        { type: String,  default: 'md' },   // 'sm' | 'md'
})

const modelValue = defineModel({ type: String, default: null })
const emit = defineEmits(['change'])

/* ── Helpers puros ─────────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, '0')

// "HH:mm" | "HH:mm:ss" → { h, m, s } (24h) | null
function parseValue (str) {
  if (!str || typeof str !== 'string') return null
  const parts = str.split(':').map((p) => parseInt(p, 10))
  const [h, m, s = 0] = parts
  if ([h, m, s].some((n) => Number.isNaN(n))) return null
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null
  return { h, m, s }
}

// { h, m, s } → "HH:mm" | "HH:mm:ss"
function composeValue (h, m, s, withSeconds) {
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`
}

// 24h hour → { h12, period }
function to12 (h) {
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return { h12, period }
}

// (displayHour 1-12, period) → 24h hour
function to24 (h12, period) {
  const base = h12 % 12 // 12 → 0
  return period === 'PM' ? base + 12 : base
}

// "HH:mm[:ss]" → segundos del día | null
function boundToSeconds (str) {
  const p = parseValue(str)
  return p ? p.h * 3600 + p.m * 60 + p.s : null
}

function partsToSeconds (h, m, s) {
  return h * 3600 + m * 60 + s
}

/* ── Estado interno (24h) ──────────────────────────────────────────────── */

const open = ref(false)
const rootEl = ref(null)
const panelEl = ref(null)

const h = ref(null) // 0-23
const m = ref(null) // 0-59
const s = ref(null) // 0-59

// Sincronizar desde el modelValue externo
watch(modelValue, (val) => {
  const parsed = parseValue(val)
  if (parsed) {
    h.value = parsed.h; m.value = parsed.m; s.value = parsed.s
  } else {
    h.value = null; m.value = null; s.value = null
  }
}, { immediate: true })

const isComplete = computed(() =>
  h.value !== null && m.value !== null && (!props.seconds || s.value !== null)
)

const period = computed(() => (h.value === null ? 'AM' : to12(h.value).period))
const displayHour = computed(() => (h.value === null ? null : to12(h.value).h12))

/* ── Display ───────────────────────────────────────────────────────────── */

const displayValue = computed(() => {
  if (!isComplete.value) return ''
  const base = props.hour12
    ? `${pad(to12(h.value).h12)}:${pad(m.value)}${props.seconds ? ':' + pad(s.value) : ''} ${to12(h.value).period}`
    : composeValue(h.value, m.value, s.value ?? 0, props.seconds)
  return base
})

/* ── Opciones de columnas ──────────────────────────────────────────────── */

const hourOptions = computed(() =>
  props.hour12
    ? Array.from({ length: 12 }, (_, i) => i + 1)           // 1..12
    : Array.from({ length: 24 }, (_, i) => i)               // 0..23
)
const minuteOptions = computed(() => {
  const step = props.step > 0 ? props.step : 1
  return Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step).filter((n) => n < 60)
})
const secondOptions = computed(() => Array.from({ length: 60 }, (_, i) => i))

/* ── Deshabilitar opciones fuera de [minTime, maxTime] ─────────────────── */

const minSec = computed(() => boundToSeconds(props.minTime))
const maxSec = computed(() => boundToSeconds(props.maxTime))

// ¿La hora resultante (usando el candidato en `col` y las otras partes actuales,
// con 0 por defecto) cae fuera de rango?
function outOfRange (col, candidate24hOrValue) {
  if (minSec.value === null && maxSec.value === null) return false
  let hh = h.value ?? 0
  let mm = m.value ?? 0
  let ss = props.seconds ? (s.value ?? 0) : 0
  if (col === 'hour') hh = candidate24hOrValue
  if (col === 'minute') mm = candidate24hOrValue
  if (col === 'second') ss = candidate24hOrValue
  const total = partsToSeconds(hh, mm, ss)
  if (minSec.value !== null && total < minSec.value) return true
  if (maxSec.value !== null && total > maxSec.value) return true
  return false
}

// candidato de hora en 24h a partir de la opción visible (respeta el período en 12h)
function hourCandidate (opt) {
  return props.hour12 ? to24(opt, period.value) : opt
}
function isHourDisabled (opt) { return outOfRange('hour', hourCandidate(opt)) }
function isMinuteDisabled (opt) { return outOfRange('minute', opt) }
function isSecondDisabled (opt) { return outOfRange('second', opt) }

/* ── Selección ─────────────────────────────────────────────────────────── */

function commit () {
  // Rellenar partes faltantes con 0 al primer toque para formar una hora válida
  if (h.value === null) h.value = 0
  if (m.value === null) m.value = 0
  if (props.seconds && s.value === null) s.value = 0
  if (!isComplete.value) return
  const val = composeValue(h.value, m.value, s.value ?? 0, props.seconds)
  modelValue.value = val
  emit('change', val)
}

function selectHour (opt) {
  if (isHourDisabled(opt)) return
  h.value = hourCandidate(opt)
  commit()
}
function selectMinute (opt) {
  if (isMinuteDisabled(opt)) return
  m.value = opt
  commit()
}
function selectSecond (opt) {
  if (isSecondDisabled(opt)) return
  s.value = opt
  commit()
}
function selectPeriod (p) {
  const dh = displayHour.value ?? 12
  h.value = to24(dh, p)
  commit()
}

function isHourSelected (opt) {
  if (h.value === null) return false
  return props.hour12 ? displayHour.value === opt : h.value === opt
}

function setNow () {
  const now = new Date()
  h.value = now.getHours()
  const step = props.step > 0 ? props.step : 1
  // snap al step, garantizando que caiga en una opción válida (0..59)
  let snapped = Math.round(now.getMinutes() / step) * step
  if (snapped > 59) snapped = Math.floor(59 / step) * step
  m.value = snapped
  s.value = props.seconds ? now.getSeconds() : 0
  commit()
  scrollSelectedIntoView()
}

function clear () {
  h.value = null; m.value = null; s.value = null
  modelValue.value = null
  emit('change', null)
}

/* ── Apertura / cierre ─────────────────────────────────────────────────── */

function toggle () {
  if (props.disabled) return
  open.value = !open.value
}
function close () { open.value = false }

function onDocClick (e) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) close()
}
function onKeydown (e) {
  if (e.key === 'Escape' && open.value) close()
}

function scrollSelectedIntoView () {
  nextTick(() => {
    if (!panelEl.value) return
    panelEl.value.querySelectorAll('[data-selected="true"]').forEach((el) => {
      el.scrollIntoView({ block: 'center' })
    })
  })
}

watch(open, (isOpen) => { if (isOpen) scrollSelectedIntoView() })

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})

const fieldClasses = computed(() => [
  'innertia-field',
  props.size === 'sm' ? 'innertia-field-sm' : '',
  'pe-10 cursor-pointer',
  props.error ? '!border-red-400 dark:!border-red-500' : '',
])
</script>

<template>
  <div ref="rootEl" class="w-full">
    <label v-if="label" class="block text-sm font-medium text-foreground mb-1.5">
      {{ label }}
    </label>

    <div class="relative">
      <div class="relative group">
        <input
          type="text"
          :value="displayValue"
          :disabled="disabled"
          :placeholder="placeholder"
          :class="fieldClasses"
          readonly
          @click="toggle"
        />

        <!-- Limpiar (con valor) o ícono reloj (vacío) -->
        <button
          v-if="clearable && displayValue && !disabled"
          type="button"
          class="absolute inset-y-0 end-0 flex items-center z-20 pe-3 text-muted-foreground hover:text-destructive transition-colors focus:outline-none"
          @click.stop="clear"
        >
          <IconX class="size-4" />
        </button>
        <div
          v-else
          class="absolute inset-y-0 end-0 flex items-center pointer-events-none z-20 pe-3"
        >
          <IconClock class="size-4 text-muted-foreground-2 group-focus-within:text-primary transition-colors" />
        </div>
      </div>

      <!-- Panel dropdown -->
      <div
        v-if="open"
        ref="panelEl"
        class="absolute z-50 mt-1 w-full min-w-56 bg-card border border-card-line rounded-card shadow-lg p-2"
      >
        <div class="flex gap-1">
          <!-- Horas -->
          <ul class="flex-1 max-h-56 overflow-y-auto pe-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-card-line">
            <li v-for="opt in hourOptions" :key="'h' + opt">
              <button
                type="button"
                :disabled="isHourDisabled(opt)"
                :data-selected="isHourSelected(opt)"
                class="w-full text-center text-sm rounded-control px-2 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                :class="isHourSelected(opt)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted-hover'"
                @click="selectHour(opt)"
              >{{ pad(opt) }}</button>
            </li>
          </ul>

          <!-- Minutos -->
          <ul class="flex-1 max-h-56 overflow-y-auto pe-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-card-line">
            <li v-for="opt in minuteOptions" :key="'m' + opt">
              <button
                type="button"
                :disabled="isMinuteDisabled(opt)"
                :data-selected="m === opt"
                class="w-full text-center text-sm rounded-control px-2 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                :class="m === opt
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted-hover'"
                @click="selectMinute(opt)"
              >{{ pad(opt) }}</button>
            </li>
          </ul>

          <!-- Segundos -->
          <ul v-if="seconds" class="flex-1 max-h-56 overflow-y-auto pe-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-card-line">
            <li v-for="opt in secondOptions" :key="'s' + opt">
              <button
                type="button"
                :disabled="isSecondDisabled(opt)"
                :data-selected="s === opt"
                class="w-full text-center text-sm rounded-control px-2 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                :class="s === opt
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted-hover'"
                @click="selectSecond(opt)"
              >{{ pad(opt) }}</button>
            </li>
          </ul>

          <!-- AM / PM -->
          <ul v-if="hour12" class="w-14 max-h-56 overflow-y-auto">
            <li v-for="p in ['AM', 'PM']" :key="p">
              <button
                type="button"
                :data-selected="period === p && h !== null"
                class="w-full text-center text-sm rounded-control px-2 py-1.5 transition-colors"
                :class="(period === p && h !== null)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted-hover'"
                @click="selectPeriod(p)"
              >{{ p }}</button>
            </li>
          </ul>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between border-t border-card-line mt-2 pt-2">
          <button
            type="button"
            class="text-xs font-medium text-primary hover:underline px-2 py-1"
            @click="setNow"
          >Ahora</button>
          <button
            type="button"
            class="text-xs font-medium text-foreground bg-muted hover:bg-muted-hover rounded-control px-3 py-1 transition-colors"
            @click="close"
          >Aceptar</button>
        </div>
      </div>
    </div>

    <p v-if="error" class="text-xs text-red-500 dark:text-red-400 mt-1">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-muted-foreground mt-1">{{ hint }}</p>
  </div>
</template>
