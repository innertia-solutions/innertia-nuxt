<script setup>
/**
 * <FormsInputPin> — Input para códigos PIN / OTP.
 *
 * Características:
 *  - Longitud configurable (default 4, soporta 4-8 dígitos)
 *  - Acepta solo dígitos (o letras si type="text")
 *  - Auto-focus al siguiente al escribir, retroceso al anterior con Backspace
 *  - Paste inteligente — pegás "123456" y se distribuye
 *  - Estados: default, error, success (vía prop o slot)
 *  - Mask opcional para passwords / códigos sensibles
 *  - Emite @complete cuando todos los slots están llenos
 *
 * ```vue
 * <FormsInputPin v-model="otp" :length="6" @complete="verify" />
 * ```
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  length:     { type: Number, default: 6 },
  /** 'number' (default) acepta solo dígitos, 'text' acepta letras también. */
  type:       { type: String, default: 'number', validator: v => ['number','text'].includes(v) },
  /** Oculta los caracteres (estilo password). */
  masked:     { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
  /** Estado de validación visual. */
  state:      { type: String, default: 'default', validator: v => ['default','error','success'].includes(v) },
  size:       { type: String, default: 'md', validator: v => ['sm','md','lg'].includes(v) },
  /** Separador visual cada N slots. Ej. 3 para "123-456". */
  separator:  { type: Number, default: 0 },
  autofocus:  { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'complete', 'change'])

const inputs = ref([])
const slots  = ref(Array.from({ length: props.length }, (_, i) =>
  (props.modelValue || '').charAt(i) || ''
))

watch(() => props.modelValue, (val) => {
  const arr = Array.from({ length: props.length }, (_, i) => (val || '').charAt(i) || '')
  if (arr.join('') !== slots.value.join('')) slots.value = arr
})

watch(() => props.length, (n) => {
  const cur = slots.value.join('').slice(0, n)
  slots.value = Array.from({ length: n }, (_, i) => cur.charAt(i) || '')
})

const sanitize = (ch) => {
  if (!ch) return ''
  if (props.type === 'number') return /[0-9]/.test(ch) ? ch : ''
  return /[a-zA-Z0-9]/.test(ch) ? ch : ''
}

const sync = () => {
  const v = slots.value.join('')
  emit('update:modelValue', v)
  emit('change', v)
  if (v.length === props.length && !v.includes('')) emit('complete', v)
}

const focusSlot = async (i) => {
  await nextTick()
  inputs.value[i]?.focus()
  inputs.value[i]?.select?.()
}

const onInput = (e, i) => {
  const raw  = e.target.value
  const last = raw.slice(-1)
  const ok   = sanitize(last)
  slots.value[i] = ok
  e.target.value = ok
  sync()
  if (ok && i < props.length - 1) focusSlot(i + 1)
}

const onKeydown = (e, i) => {
  if (e.key === 'Backspace') {
    if (slots.value[i]) {
      slots.value[i] = ''
      sync()
    } else if (i > 0) {
      slots.value[i - 1] = ''
      sync()
      focusSlot(i - 1)
    }
    e.preventDefault()
  } else if (e.key === 'ArrowLeft' && i > 0) {
    focusSlot(i - 1)
  } else if (e.key === 'ArrowRight' && i < props.length - 1) {
    focusSlot(i + 1)
  } else if (e.key === 'Enter') {
    const v = slots.value.join('')
    if (v.length === props.length && !v.includes('')) emit('complete', v)
  }
}

const onPaste = (e, i) => {
  e.preventDefault()
  const text = (e.clipboardData?.getData('text') ?? '').trim()
  if (!text) return
  let j = i
  for (const ch of text) {
    const ok = sanitize(ch)
    if (!ok) continue
    if (j >= props.length) break
    slots.value[j] = ok
    j++
  }
  sync()
  focusSlot(Math.min(j, props.length - 1))
}

const onFocus = (e) => e.target.select?.()

onMounted(() => {
  if (props.autofocus) focusSlot(0)
})

const slotClass = computed(() => {
  const sizeMap = {
    sm: 'size-9 text-base',
    md: 'size-11 text-lg',
    lg: 'size-14 text-2xl',
  }[props.size]
  const stateMap = {
    default: 'border-card-line focus:border-primary focus:ring-2 focus:ring-primary/20',
    error:   'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-red-600',
    success: 'border-emerald-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-emerald-600',
  }[props.state]
  return `${sizeMap} ${stateMap} text-center font-mono font-semibold tabular-nums bg-card text-foreground rounded-control border outline-none transition-colors`
})
</script>

<template>
  <div class="inline-flex items-center gap-1.5">
    <template v-for="(_, i) in slots" :key="i">
      <input
        :ref="el => inputs[i] = el"
        :type="masked ? 'password' : (type === 'number' ? 'tel' : 'text')"
        :inputmode="type === 'number' ? 'numeric' : 'text'"
        :pattern="type === 'number' ? '[0-9]*' : null"
        :value="slots[i]"
        :disabled="disabled"
        :maxlength="1"
        autocomplete="one-time-code"
        :class="slotClass"
        @input="e => onInput(e, i)"
        @keydown="e => onKeydown(e, i)"
        @paste="e => onPaste(e, i)"
        @focus="onFocus"
      />
      <span
        v-if="separator > 0 && (i + 1) % separator === 0 && i < length - 1"
        class="text-muted-foreground text-xl select-none"
      >–</span>
    </template>
  </div>
</template>
