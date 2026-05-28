<script setup>
/**
 * <Attention> — Wrapper que aplica efectos de "llamar la atención" a su slot.
 *
 * Efectos:
 *  - 'ping'           → ondas de radar concéntricas saliendo del elemento
 *  - 'pulse'          → respiración (scale 1 → 1.05)
 *  - 'shake'          → vibración tipo campana (rotate)
 *  - 'bounce'         → rebote vertical
 *  - 'glow'           → halo de color difuminado
 *  - 'shimmer-border' → borde con gradiente cónico multicolor girando
 *
 * Props clave:
 *  - active      → encender/apagar la animación
 *  - color       → semántico ('primary','success','danger','warning'...) o CSS color
 *  - colors      → array para shimmer-border (multicolor)
 *  - intensity   → 'subtle' | 'normal' | 'strong' (escala los keyframes)
 *  - duration    → ms (por defecto depende del efecto)
 *  - border      → grosor del shimmer-border en px
 *  - radius      → radio del wrapper (para que rings/glow lo respeten)
 *  - count       → número de iteraciones (default Infinity)
 *
 * ```vue
 * <Attention effect="ping" color="danger" radius="full">
 *   <button class="bg-red-500 size-10 rounded-full"><IconBell /></button>
 * </Attention>
 *
 * <Attention effect="shake" :duration="1500">
 *   <IconBell class="size-6 text-amber-500" />
 * </Attention>
 *
 * <Attention effect="shimmer-border" :colors="['#3b82f6','#8b5cf6','#ec4899']" radius="md">
 *   <button class="px-4 py-2 bg-card">Probar PRO</button>
 * </Attention>
 * ```
 */

const props = defineProps({
  effect:    { type: String, default: 'ping', validator: v => ['ping','pulse','shake','bounce','glow','shimmer-border'].includes(v) },
  active:    { type: Boolean, default: true },
  color:     { type: String,  default: 'primary' },
  colors:    { type: Array,   default: () => ['#3b82f6', '#8b5cf6', '#ec4899'] }, // para shimmer-border
  intensity: { type: String,  default: 'normal', validator: v => ['subtle','normal','strong'].includes(v) },
  duration:  { type: Number,  default: 0 }, // 0 = default por efecto
  border:    { type: Number,  default: 2 },
  /** Radio del wrapper: 'inherit' | 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full' o un valor CSS. */
  radius:    { type: String,  default: 'inherit' },
  /** Iteraciones de la animación. Default 'infinite'. Pasá un número para limitar. */
  count:     { type: [Number, String], default: 'infinite' },
})

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

const radiusMap = {
  inherit: 'inherit',
  none:    '0',
  sm:      'var(--radius-sm, 0.25rem)',
  md:      'var(--radius-control, 0.5rem)',
  lg:      'var(--radius-card, 0.75rem)',
  xl:      'var(--radius-xl, 1rem)',
  full:    '9999px',
}
const resolvedRadius = computed(() => radiusMap[props.radius] ?? props.radius)

// Duración default por efecto — más lentas = más sofisticadas.
const defaultDuration = {
  ping: 2400,
  pulse: 2400,
  shake: 1400,
  bounce: 1400,
  glow: 2800,
  'shimmer-border': 4500,
}
const resolvedDuration = computed(() => props.duration > 0 ? props.duration : (defaultDuration[props.effect] ?? 1800))

const intensityScale = computed(() => ({ subtle: 0.6, normal: 1, strong: 1.5 }[props.intensity] ?? 1))

const cssVars = computed(() => ({
  '--att-color':      resolvedColor.value,
  '--att-c1':         props.colors[0] ?? resolvedColor.value,
  '--att-c2':         props.colors[1] ?? resolvedColor.value,
  '--att-c3':         props.colors[2] ?? resolvedColor.value,
  '--att-c4':         props.colors[3] ?? props.colors[0] ?? resolvedColor.value,
  '--att-dur':        resolvedDuration.value + 'ms',
  '--att-radius':     resolvedRadius.value,
  '--att-border':     props.border + 'px',
  '--att-scale':      intensityScale.value,
  '--att-count':      String(props.count),
}))

const hasRings        = computed(() => props.active && props.effect === 'ping')
const hasGlow         = computed(() => props.active && props.effect === 'glow')
const hasShimmer      = computed(() => props.active && props.effect === 'shimmer-border')
const hasInlineEffect = computed(() => props.active && ['pulse','shake','bounce'].includes(props.effect))
</script>

<template>
  <span
    class="att-wrap"
    :class="active ? `att-mode-${effect}` : ''"
    :style="cssVars"
  >
    <!-- Ondas de radar (ping) -->
    <span v-if="hasRings" class="att-ring att-ring-a" aria-hidden="true" />
    <span v-if="hasRings" class="att-ring att-ring-b" aria-hidden="true" />

    <!-- Halo (glow) -->
    <span v-if="hasGlow" class="att-glow" aria-hidden="true" />

    <!-- Borde gradiente cónico (shimmer-border) -->
    <span v-if="hasShimmer" class="att-shimmer" aria-hidden="true" />

    <!-- Contenido — recibe la transformación cuando aplica -->
    <span
      class="att-content"
      :class="hasInlineEffect ? `att-anim-${effect}` : ''"
    >
      <slot />
    </span>
  </span>
</template>

<style scoped>
/* Custom property registrada para que el ángulo del conic-gradient pueda
   interpolar via animation (sin esto, no anima). */
@property --att-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.att-wrap {
  position: relative;
  display: inline-flex;
  isolation: isolate;
  border-radius: var(--att-radius);
}
.att-content {
  position: relative;
  display: inline-flex;
  z-index: 1;
  border-radius: inherit;
}

/* ── PING — onda discreta ───────────────────────────────────────────── */
.att-ring {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid var(--att-color);
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  animation: att-ping var(--att-dur) cubic-bezier(0, 0, 0.2, 1) var(--att-count);
}
.att-ring-b { animation-delay: calc(var(--att-dur) / 2); }
@keyframes att-ping {
  0%   { transform: scale(1);   opacity: calc(0.5 * var(--att-scale)); }
  100% { transform: scale(calc(1.35 + 0.25 * var(--att-scale))); opacity: 0; }
}

/* ── PULSE — respiración casi imperceptible ─────────────────────────── */
.att-anim-pulse {
  animation: att-pulse var(--att-dur) ease-in-out var(--att-count);
}
@keyframes att-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(calc(1 + 0.025 * var(--att-scale))); }
}

/* ── SHAKE — leve oscilación ────────────────────────────────────────── */
.att-anim-shake {
  animation: att-shake var(--att-dur) ease-in-out var(--att-count);
  transform-origin: top center;
}
@keyframes att-shake {
  0%, 60%, 100%        { transform: rotate(0); }
  10%, 30%             { transform: rotate(calc(-7deg * var(--att-scale))); }
  20%, 40%             { transform: rotate(calc(7deg * var(--att-scale))); }
  50%                  { transform: rotate(0); }
}

/* ── BOUNCE — rebote sutil ──────────────────────────────────────────── */
.att-anim-bounce {
  animation: att-bounce var(--att-dur) cubic-bezier(.5,.05,.5,1) var(--att-count);
}
@keyframes att-bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(calc(-3px * var(--att-scale))); }
}

/* ── GLOW — halo difuso muy tenue ───────────────────────────────────── */
.att-glow {
  position: absolute;
  inset: calc(-2px * var(--att-scale));
  border-radius: inherit;
  background: var(--att-color);
  filter: blur(calc(10px * var(--att-scale)));
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  animation: att-glow var(--att-dur) ease-in-out var(--att-count);
}
@keyframes att-glow {
  0%, 100% { opacity: calc(0.10 * var(--att-scale)); }
  50%      { opacity: calc(0.28 * var(--att-scale)); }
}

/* ── SHIMMER-BORDER — gradiente fluyendo por el borde ───────────────── */
/* Técnica: contenedor con conic-gradient + mask hueco para que sólo se
   renderice el borde. El ángulo del gradiente se anima (no el elemento)
   para que el flujo sea suave y los corners no se vean. */
.att-shimmer {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: var(--att-border);
  background:
    conic-gradient(
      from var(--att-angle),
      var(--att-c1),
      var(--att-c2),
      var(--att-c3),
      var(--att-c4),
      var(--att-c1)
    );
  /* Hueco: pinta sólo el padding (el borde). */
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
          mask-composite: exclude;
  pointer-events: none;
  z-index: 2;  /* Por encima del contenido para que se vea como borde. */
  animation: att-angle var(--att-dur) linear var(--att-count);
}
@keyframes att-angle {
  to { --att-angle: 360deg; }
}

/* Reducción de animaciones por accesibilidad */
@media (prefers-reduced-motion: reduce) {
  .att-ring,
  .att-glow,
  .att-shimmer,
  .att-anim-pulse,
  .att-anim-shake,
  .att-anim-bounce { animation: none !important; }
}
</style>
