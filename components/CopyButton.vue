<script setup>
import { IconCopy, IconCheck } from '@tabler/icons-vue'

/**
 * <CopyButton :value="..." /> — Botón con feedback visual de copia.
 *
 * Variants:
 *  - 'icon'   (default) — solo el icono
 *  - 'inline' — input readonly con icono al lado (estilo Preline clipboard)
 *  - 'button' — botón ancho con label "Copiar"
 *
 * ```vue
 * <CopyButton :value="user.id" />
 * <CopyButton :value="apiKey" variant="inline" />
 * <CopyButton :value="link" variant="button" label="Copiar enlace" />
 * ```
 */
const props = defineProps({
  value:        { type: [String, Number], default: '' },
  variant:      { type: String, default: 'icon', validator: v => ['icon','inline','button'].includes(v) },
  label:        { type: String, default: 'Copiar' },
  labelCopied:  { type: String, default: '¡Copiado!' },
  size:         { type: String, default: 'sm', validator: v => ['xs','sm','md'].includes(v) },
  /** Solo para variant="inline" — placeholder cuando el value está vacío. */
  placeholder:  { type: String, default: '' },
  /** Solo para variant="inline" — oculta el value (útil para tokens/passwords). */
  masked:       { type: Boolean, default: false },
})

const emit = defineEmits(['copied'])

const { copy, copied } = useClipboard({ timeout: 1500 })

const onCopy = async () => {
  if (await copy(props.value)) emit('copied', props.value)
}

const iconSize = computed(() => ({ xs: 12, sm: 14, md: 16 }[props.size]))
const btnSize  = computed(() => ({ xs: 'size-6', sm: 'size-7', md: 'size-8' }[props.size]))

const displayValue = computed(() => {
  if (!props.value) return ''
  if (!props.masked) return String(props.value)
  return String(props.value).replace(/./g, '•').slice(0, 32)
})
</script>

<template>
  <!-- Icon-only -->
  <button
    v-if="variant === 'icon'"
    type="button"
    :title="copied ? labelCopied : label"
    :class="[btnSize, 'inline-flex items-center justify-center rounded-control transition-colors',
             copied ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted-hover']"
    @click="onCopy"
  >
    <IconCheck v-if="copied" :size="iconSize" :stroke="2" />
    <IconCopy  v-else        :size="iconSize" :stroke="1.75" />
  </button>

  <!-- Inline input + icon (Preline clipboard style) -->
  <div
    v-else-if="variant === 'inline'"
    class="inline-flex items-center gap-2 w-full innertia-field !pr-1 !py-1 cursor-pointer"
    @click="onCopy"
  >
    <span class="flex-1 truncate text-sm text-foreground font-mono">
      {{ displayValue || placeholder }}
    </span>
    <button
      type="button"
      :class="['shrink-0 inline-flex items-center justify-center size-7 rounded-control transition-colors',
               copied ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted-hover']"
      @click.stop="onCopy"
    >
      <IconCheck v-if="copied" :size="14" :stroke="2" />
      <IconCopy  v-else        :size="14" :stroke="1.75" />
    </button>
  </div>

  <!-- Full button -->
  <button
    v-else
    type="button"
    :class="['inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium transition-colors border',
             copied
               ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
               : 'bg-card text-foreground border-card-line hover:bg-muted-hover']"
    @click="onCopy"
  >
    <IconCheck v-if="copied" :size="14" :stroke="2" />
    <IconCopy  v-else        :size="14" :stroke="1.75" />
    {{ copied ? labelCopied : label }}
  </button>
</template>
