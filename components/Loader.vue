<script setup>
/**
 * <Loader> — Indicador configurable de progreso / countdown / indeterminate.
 *
 * shape:
 *   - 'circle' (default) — círculo SVG con stroke-dasharray
 *   - 'square'           — cuadrado SVG con stroke-dasharray sobre el perímetro
 *   - 'bar'              — barra horizontal
 *   - 'dots'             — 3 puntitos pulsantes (solo indeterminate)
 *
 * mode:
 *   - 'progress'      — controlado por prop `value` (0-100)
 *   - 'countdown'     — anima de A→B durante `duration` ms y emite @complete
 *   - 'indeterminate' — animación continua (rotación / pulso)
 *
 * direction (solo countdown/progress):
 *   - 'fill'  — de 0 → value (default)
 *   - 'empty' — de 100 → 0 (típico para countdowns "tiempo restante")
 *
 * ```vue
 * <!-- countdown circular -->
 * <Loader shape="circle" mode="countdown" :duration="5000" direction="empty"
 *         :size="22" :stroke="2" color="emerald" />
 *
 * <!-- progress controlado -->
 * <Loader shape="circle" :value="65" :size="64" :stroke="6" color="primary" show-value />
 *
 * <!-- spinner indeterminate -->
 * <Loader shape="circle" mode="indeterminate" :size="32" :stroke="3" color="primary" />
 *
 * <!-- barra -->
 * <Loader shape="bar" :value="40" :stroke="6" color="emerald" />
 *
 * <!-- cuadrado de countdown -->
 * <Loader shape="square" mode="countdown" :duration="3000" :size="48" :stroke="4" />
 *
 * <!-- dots indeterminate -->
 * <Loader shape="dots" color="primary" />
 * ```
 */

const props = defineProps({
  shape:      { type: String,  default: 'circle', validator: v => ['circle','square','bar','dots'].includes(v) },
  mode:       { type: String,  default: 'progress', validator: v => ['progress','countdown','indeterminate'].includes(v) },
  /** 0-100. Solo aplica en mode='progress'. */
  value:      { type: Number,  default: 0 },
  /** ms. Solo aplica en mode='countdown' (y para 'indeterminate' bar/dots define velocidad). */
  duration:   { type: Number,  default: 3000 },
  /** 'fill' (0→value) o 'empty' (100→0). */
  direction:  { type: String,  default: 'fill', validator: v => ['fill','empty'].includes(v) },
  /** Tamaño en px o preset xs|sm|md|lg|xl. Para 'bar' sólo afecta la altura via `stroke`. */
  size:       { type: [Number, String], default: 32 },
  /** Grosor del trazo (circle/square) o alto de la barra (bar). */
  stroke:     { type: Number,  default: 3 },
  /** Color del trazo. Acepta semánticos (primary/success/danger/warning/info/muted/foreground/emerald/red/amber/blue) o cualquier color CSS. */
  color:      { type: String,  default: 'primary' },
  /** Color del track (background). 'auto' usa --color-muted. */
  track:      { type: String,  default: 'auto' },
  /** Linecaps/corners redondeados. */
  rounded:    { type: Boolean, default: true },
  /** Muestra el % en el centro (circle/square). */
  showValue:  { type: Boolean, default: false },
  /** Texto custom en el centro (override de showValue). */
  label:      { type: String,  default: '' },
  /** Auto-arrancar countdown al montar. */
  autoStart:  { type: Boolean, default: true },
})

const emit = defineEmits(['complete', 'tick'])

// ── Color resolution ────────────────────────────────────────────────────────
const COLOR_MAP = {
  primary:    'var(--color-primary)',
  foreground: 'var(--color-foreground)',
  muted:      'var(--color-muted-foreground)',
  success:    '#10b981',
  danger:     '#ef4444',
  warning:    '#f59e0b',
  info:       '#3b82f6',
  emerald:    '#10b981',
  red:        '#ef4444',
  amber:      '#f59e0b',
  blue:       '#3b82f6',
  violet:     '#8b5cf6',
  pink:       '#ec4899',
}

const resolvedColor = computed(() => COLOR_MAP[props.color] ?? props.color)
const resolvedTrack = computed(() => {
  if (props.track !== 'auto') return COLOR_MAP[props.track] ?? props.track
  return 'color-mix(in srgb, currentColor 15%, transparent)'
})

// ── Size resolution ─────────────────────────────────────────────────────────
const resolvedSize = computed(() => {
  if (typeof props.size === 'number') return props.size
  return { xs: 14, sm: 20, md: 32, lg: 48, xl: 64 }[props.size] ?? 32
})

// ── State (currentValue 0-100) ──────────────────────────────────────────────
const initialValue = () => {
  if (props.mode === 'countdown') return props.direction === 'empty' ? 100 : 0
  if (props.mode === 'progress')  return props.value
  return 0
}
const currentValue = ref(initialValue())

let raf = null
let startedAt = 0

const start = () => {
  stop()
  if (props.mode !== 'countdown') return
  currentValue.value = props.direction === 'empty' ? 100 : 0
  startedAt = performance.now()
  const tick = (now) => {
    const elapsed = now - startedAt
    const t = Math.min(1, elapsed / props.duration)
    currentValue.value = props.direction === 'empty' ? 100 * (1 - t) : 100 * t
    emit('tick', currentValue.value)
    if (t < 1) {
      raf = requestAnimationFrame(tick)
    } else {
      raf = null
      emit('complete')
    }
  }
  raf = requestAnimationFrame(tick)
}

/** Loop infinito 0→100 (usado por square indeterminate — CSS keyframes con
 *  var() en stroke-dashoffset no interpola sin @property registrado). */
const startIndeterminateLoop = () => {
  stop()
  const loopDur = props.duration > 0 ? props.duration : 1200
  startedAt = performance.now()
  const tick = (now) => {
    const elapsed = (now - startedAt) % loopDur
    currentValue.value = (elapsed / loopDur) * 100
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

const stop = () => {
  if (raf) { cancelAnimationFrame(raf); raf = null }
}

watch(() => props.value, v => {
  if (props.mode === 'progress') currentValue.value = v
})

const needsIndeterminateLoop = computed(
  () => props.mode === 'indeterminate' && props.shape === 'square'
)

watch(() => [props.mode, props.duration, props.direction, props.shape], () => {
  if (props.mode === 'countdown' && props.autoStart) {
    start()
  } else if (props.mode === 'progress') {
    stop()
    currentValue.value = props.value
  } else if (needsIndeterminateLoop.value) {
    startIndeterminateLoop()
  } else {
    stop()
  }
})

onMounted(() => {
  if (props.mode === 'countdown' && props.autoStart) start()
  else if (needsIndeterminateLoop.value) startIndeterminateLoop()
})
onBeforeUnmount(stop)

defineExpose({ start, stop, restart: start })

// ── Geometría SVG ───────────────────────────────────────────────────────────
// viewBox = 100x100 para todas las shapes — escala con width/height.
const radius        = computed(() => 50 - props.stroke / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset    = computed(() => circumference.value * (1 - currentValue.value / 100))

// Rect inscripto en viewBox con el stroke considerado
const squareGeom = computed(() => ({
  x: props.stroke / 2,
  y: props.stroke / 2,
  size: 100 - props.stroke,
  rx: props.rounded ? Math.max(4, props.stroke * 1.5) : 0,
}))
// Aproximación al perímetro (rect con esquinas redondeadas)
const squarePerim = computed(() => {
  const s   = squareGeom.value.size
  const rx  = squareGeom.value.rx
  return 4 * (s - 2 * rx) + 2 * Math.PI * rx
})
const squareOffset = computed(() => squarePerim.value * (1 - currentValue.value / 100))

const isIndeterminate = computed(() => props.mode === 'indeterminate')

// Transición CSS para que el dashoffset interpole suave en mode='progress'
const transitionStyle = computed(() => {
  if (props.mode === 'progress') return 'stroke-dashoffset 0.25s cubic-bezier(.2,.8,.2,1)'
  return 'none'
})
</script>

<template>
  <!-- ── CIRCLE ────────────────────────────────────────────────────────── -->
  <div
    v-if="shape === 'circle'"
    class="relative inline-flex items-center justify-center shrink-0"
    :style="{ width: resolvedSize + 'px', height: resolvedSize + 'px', color: resolvedColor }"
    :aria-label="label || `loader ${Math.round(currentValue)}%`"
    role="progressbar"
  >
    <svg
      :width="resolvedSize"
      :height="resolvedSize"
      viewBox="0 0 100 100"
      :class="isIndeterminate ? 'loader-spin' : ''"
      :style="isIndeterminate ? { animationDuration: duration + 'ms' } : {}"
    >
      <circle cx="50" cy="50" :r="radius" fill="none" :stroke="resolvedTrack" :stroke-width="stroke" />
      <circle
        cx="50" cy="50" :r="radius" fill="none"
        :stroke="resolvedColor"
        :stroke-width="stroke"
        :stroke-dasharray="isIndeterminate ? `${circumference * 0.25} ${circumference}` : circumference"
        :stroke-dashoffset="isIndeterminate ? 0 : dashOffset"
        :stroke-linecap="rounded ? 'round' : 'butt'"
        transform="rotate(-90 50 50)"
        :style="{ transition: transitionStyle }"
      />
    </svg>
    <span v-if="showValue || label || $slots.default"
      class="absolute text-[10px] font-semibold text-foreground tabular-nums leading-none">
      <slot>{{ label || `${Math.round(currentValue)}%` }}</slot>
    </span>
  </div>

  <!-- ── SQUARE (no rota — el stroke recorre el perímetro) ────────────── -->
  <div
    v-else-if="shape === 'square'"
    class="relative inline-flex items-center justify-center shrink-0"
    :style="{ width: resolvedSize + 'px', height: resolvedSize + 'px', color: resolvedColor }"
    role="progressbar"
  >
    <svg :width="resolvedSize" :height="resolvedSize" viewBox="0 0 100 100">
      <rect
        :x="squareGeom.x" :y="squareGeom.y"
        :width="squareGeom.size" :height="squareGeom.size"
        :rx="squareGeom.rx"
        fill="none" :stroke="resolvedTrack" :stroke-width="stroke"
      />
      <rect
        :x="squareGeom.x" :y="squareGeom.y"
        :width="squareGeom.size" :height="squareGeom.size"
        :rx="squareGeom.rx"
        fill="none"
        :stroke="resolvedColor"
        :stroke-width="stroke"
        :stroke-dasharray="isIndeterminate ? `${squarePerim * 0.25} ${squarePerim * 0.75}` : squarePerim"
        :stroke-dashoffset="squareOffset"
        :stroke-linecap="rounded ? 'round' : 'butt'"
        :style="{ transition: isIndeterminate ? 'none' : transitionStyle }"
      />
    </svg>
    <span v-if="showValue || label || $slots.default"
      class="absolute text-[10px] font-semibold text-foreground tabular-nums leading-none">
      <slot>{{ label || `${Math.round(currentValue)}%` }}</slot>
    </span>
  </div>

  <!-- ── BAR ───────────────────────────────────────────────────────────── -->
  <div
    v-else-if="shape === 'bar'"
    class="w-full relative overflow-hidden"
    :style="{
      height: stroke + 'px',
      backgroundColor: resolvedTrack,
      borderRadius: rounded ? '999px' : '0',
      color: resolvedColor,
    }"
    role="progressbar"
  >
    <div
      v-if="!isIndeterminate"
      class="h-full"
      :style="{
        width: currentValue + '%',
        backgroundColor: resolvedColor,
        borderRadius: rounded ? '999px' : '0',
        transition: props.mode === 'progress' ? 'width 0.25s cubic-bezier(.2,.8,.2,1)' : 'width 100ms linear',
      }"
    />
    <div
      v-else
      class="absolute inset-y-0 w-1/3 loader-bar-indeterminate"
      :style="{
        backgroundColor: resolvedColor,
        borderRadius: rounded ? '999px' : '0',
        animationDuration: duration + 'ms',
      }"
    />
  </div>

  <!-- ── DOTS (sólo indeterminate) ────────────────────────────────────── -->
  <div
    v-else-if="shape === 'dots'"
    class="inline-flex items-center gap-1"
    :style="{ color: resolvedColor }"
    role="progressbar"
  >
    <span
      v-for="i in 3" :key="i"
      class="loader-dot rounded-full"
      :style="{
        width:  Math.max(4, stroke * 1.5) + 'px',
        height: Math.max(4, stroke * 1.5) + 'px',
        backgroundColor: resolvedColor,
        animationDelay: ((i - 1) * 0.15) + 's',
        animationDuration: duration + 'ms',
      }"
    />
  </div>
</template>

<style scoped>
.loader-spin {
  animation: loader-spin 1.2s linear infinite;
  transform-origin: center;
}
@keyframes loader-spin {
  to { transform: rotate(360deg); }
}

/* Square indeterminate: el `stroke-dashoffset` se anima vía rAF en JS porque
   CSS keyframes con `calc(var(--x) * -1)` no interpola en stroke-dashoffset
   sin registrar la var con @property. Driveado por currentValue (loop 0→100). */

.loader-bar-indeterminate {
  animation: loader-bar 1.4s ease-in-out infinite;
}
@keyframes loader-bar {
  0%   { transform: translateX(-100%); }
  50%  { transform: translateX(150%); }
  100% { transform: translateX(150%); }
}

.loader-dot {
  animation: loader-dot 1.2s ease-in-out infinite both;
}
@keyframes loader-dot {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1); }
}
</style>
