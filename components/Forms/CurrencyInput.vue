<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

/*
 * CurrencyInput — input de moneda con formato SOLO visual.
 * El `v-model` es SIEMPRE un número puro (o null); lo que se muestra es el valor
 * agrupado con separador de miles y prefijo (ej. "$2.234.234"). Pensado para CLP
 * (entero, sin decimales); `locale`/`prefix` lo hacen reusable.
 */
const props = withDefaults(defineProps<{
  label?: string
  placeholder?: string
  disabled?: boolean
  error?: string | null
  hint?: string
  size?: 'sm' | 'md'
  prefix?: string
  locale?: string
  min?: number | null
}>(), {
  prefix: '$',
  locale: 'es-CL',
  min: null,
})

const model = defineModel<number | null>({ default: null })

const inputEl = ref<HTMLInputElement | null>(null)
const focused = ref(false)

const nf = computed(() => new Intl.NumberFormat(props.locale, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}))

function format(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  return props.prefix + nf.value.format(n)
}

function parse(str: string): number | null {
  const digits = (str || '').replace(/\D/g, '')
  if (!digits) return null
  return Number(digits)
}

const display = ref(format(model.value))

// Mantener el display en sync cuando el valor cambia desde fuera (no mientras escribe).
watch(model, (v) => {
  if (!focused.value) display.value = format(v)
})

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  let n = parse(el.value)
  if (n !== null && props.min !== null && n < props.min) n = props.min
  model.value = n
  display.value = format(n)
  // Caret al final tras reformatear (evita saltos raros al agrupar).
  nextTick(() => {
    const len = inputEl.value?.value.length ?? 0
    inputEl.value?.setSelectionRange(len, len)
  })
}

function onBlur() {
  focused.value = false
  display.value = format(model.value)
}

const baseClasses = computed(() =>
  `innertia-field${props.size === 'sm' ? ' innertia-field-sm' : ''}`,
)
</script>

<template>
  <div class="w-full">
    <label v-if="label" class="block text-sm font-medium text-foreground mb-1.5">
      {{ label }}
    </label>

    <input
      ref="inputEl"
      type="text"
      inputmode="numeric"
      :value="display"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="[baseClasses, error ? '!border-red-400 dark:!border-red-500' : '']"
      @input="onInput"
      @focus="focused = true"
      @blur="onBlur"
    />

    <p v-if="error" class="text-xs text-red-500 dark:text-red-400 mt-1">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-muted-foreground mt-1">{{ hint }}</p>
  </div>
</template>
