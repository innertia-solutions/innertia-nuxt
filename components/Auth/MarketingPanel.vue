<script setup lang="ts">
/**
 * Panel marketing del auth layout — typewriter + tagline + footer con items.
 *
 * Lee contenido desde `appConfig.innertia.marketing`. Si no hay contenido configurado,
 * renderiza vacío para que el producto pueda llenarlo via slots del layout o no mostrarlo.
 *
 * Colores: usa --primary (configurable via appConfig.innertia.colors.primary).
 */

const appConfig = useAppConfig()
const marketing = computed(() => appConfig.innertia?.marketing ?? {
  words: [],
  tagline: '',
  description: '',
  footer: { title: '', items: [], description: '' },
})

const hasContent = computed(() =>
  (marketing.value.words ?? []).length > 0 ||
  !!marketing.value.tagline ||
  !!marketing.value.description ||
  !!marketing.value.footer?.title
)

// ── Typewriter ─────────────────────────────────────────────────────────────
const typed = ref('')
const cursor = ref(true)
let wordIdx = 0
let charIdx = 0
let deleting = false
let typeTimeout: ReturnType<typeof setTimeout> | null = null
let cursorInterval: ReturnType<typeof setInterval> | null = null

function typeStep() {
  const words = marketing.value.words ?? []
  if (words.length === 0) return

  const word = words[wordIdx]
  if (!deleting) {
    charIdx++
    typed.value = word.slice(0, charIdx)
    if (charIdx === word.length) {
      deleting = true
      typeTimeout = setTimeout(typeStep, 1600)
      return
    }
    typeTimeout = setTimeout(typeStep, 90)
  } else {
    charIdx--
    typed.value = word.slice(0, charIdx)
    if (charIdx === 0) {
      deleting = false
      wordIdx = (wordIdx + 1) % words.length
      typeTimeout = setTimeout(typeStep, 300)
      return
    }
    typeTimeout = setTimeout(typeStep, 50)
  }
}

onMounted(() => {
  if ((marketing.value.words ?? []).length > 0) {
    typeStep()
    cursorInterval = setInterval(() => { cursor.value = !cursor.value }, 530)
  }
})

onUnmounted(() => {
  if (typeTimeout) clearTimeout(typeTimeout)
  if (cursorInterval) clearInterval(cursorInterval)
})

// ── Mouse glow ─────────────────────────────────────────────────────────────
const mouseX = ref(50)
const mouseY = ref(50)
const glowVisible = ref(false)

function onMouseMove(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  mouseX.value = ((e.clientX - rect.left) / rect.width) * 100
  mouseY.value = ((e.clientY - rect.top) / rect.height) * 100
  glowVisible.value = true
}

function onMouseLeave() {
  glowVisible.value = false
}

const dotMaskStyle = computed(() => ({
  opacity: glowVisible.value ? 1 : 0,
  backgroundImage: 'radial-gradient(circle, var(--primary-300, rgba(196,181,253,0.55)) 1.5px, transparent 1.5px)',
  backgroundSize: '22px 22px',
  WebkitMaskImage: `radial-gradient(circle 180px at ${mouseX.value}% ${mouseY.value}%, black 0%, transparent 70%)`,
  maskImage: `radial-gradient(circle 180px at ${mouseX.value}% ${mouseY.value}%, black 0%, transparent 70%)`,
  transition: 'opacity 0.5s ease',
}))

// Tagline puede tener \n para saltos de línea
const taglineLines = computed(() => (marketing.value.tagline ?? '').split('\n'))
</script>

<template>
  <div
    class="hidden lg:flex lg:w-[42%] xl:w-[38%] bg-primary-50 dark:bg-slate-950 flex-col justify-between p-10 relative overflow-hidden shrink-0"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- Decoración de fondo -->
    <div class="absolute inset-0 pointer-events-none">
      <!-- Cuadrícula de puntos base — light mode -->
      <div
        class="absolute inset-0 dark:hidden"
        :style="{
          backgroundImage: 'radial-gradient(circle, var(--primary-900, rgba(76,29,149,0.5)) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          opacity: 0.18,
        }"
      />
      <!-- Cuadrícula de puntos base — dark mode -->
      <div
        class="absolute inset-0 hidden dark:block"
        style="background-image: radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px); background-size: 22px 22px; opacity: 0.18;"
      />

      <!-- Cuadrícula brillante enmascarada al cursor -->
      <div class="absolute inset-0" :style="dotMaskStyle" />

      <!-- Blobs estáticos -->
      <div class="absolute -top-32 -left-32 size-96 rounded-full bg-primary-400/25 dark:bg-primary-600/10 blur-3xl" />
      <div class="absolute bottom-0 right-0 size-80 rounded-full bg-primary-500/20 dark:bg-primary-800/10 blur-3xl" />
    </div>

    <!-- Logo (slot opcional, default: logos del /public del producto) -->
    <div class="relative z-10">
      <slot name="logo">
        <img src="/isologo-light.png" :alt="appConfig.innertia?.branding?.name ?? 'Logo'" class="h-8 dark:hidden" />
        <img src="/isologo-dark.png" :alt="appConfig.innertia?.branding?.name ?? 'Logo'" class="h-8 hidden dark:block" />
      </slot>
    </div>

    <!-- Tagline + typewriter -->
    <div v-if="hasContent" class="relative z-10 space-y-5">
      <h2 class="text-4xl xl:text-5xl font-bold text-slate-900 dark:text-white leading-snug">
        <template v-if="(marketing.words ?? []).length > 0">
          <span class="text-primary-700 dark:text-primary-300">
            {{ typed }}<span
              :class="cursor ? 'opacity-60' : 'opacity-0'"
              class="inline-block w-px h-[0.85em] bg-primary-700/60 dark:bg-primary-300/60 align-middle ml-0.5 transition-opacity duration-100"
            />
          </span><br />
        </template>
        <template v-for="(line, i) in taglineLines" :key="i">
          {{ line }}<br v-if="i < taglineLines.length - 1" />
        </template>
      </h2>
      <p v-if="marketing.description" class="text-slate-700 dark:text-slate-400 text-sm leading-relaxed max-w-xs">
        {{ marketing.description }}
      </p>
    </div>

    <!-- Footer items -->
    <div v-if="marketing.footer?.title || (marketing.footer?.items ?? []).length > 0" class="relative z-10 space-y-3">
      <p v-if="marketing.footer.title" class="text-xs font-medium text-slate-600 dark:text-slate-500 uppercase tracking-widest">
        {{ marketing.footer.title }}
      </p>
      <div v-if="(marketing.footer.items ?? []).length > 0" class="flex flex-wrap items-center gap-2">
        <span
          v-for="item in marketing.footer.items"
          :key="item"
          class="inline-flex items-center rounded-md border border-slate-900/10 bg-white/40 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
        >{{ item }}</span>
      </div>
      <p v-if="marketing.footer.description" class="text-xs text-slate-600 dark:text-slate-600 leading-relaxed">
        {{ marketing.footer.description }}
      </p>
    </div>
  </div>
</template>
