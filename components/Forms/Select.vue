<script setup lang="ts">
const props = withDefaults(defineProps<{
  options: { value: string | number; label: string; disabled?: boolean }[]
  modelValue?: string | number | null
  label?: string
  placeholder?: string
  hint?: string
  error?: string
  disabled?: boolean
  /** Opciones cargándose desde BD: muestra un loader en vez del select. */
  loading?: boolean
  /** Falló la carga de opciones: muestra mensaje + botón Reintentar (emite 'retry'). */
  loadError?: boolean | string
  /** Permite volver a "Seleccionar…" (blanquear la selección). Default true. */
  clearable?: boolean
}>(), {
  clearable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  change: [value: string | number | null]
  retry: []
}>()

const loadErrorMessage = computed(() =>
  typeof props.loadError === 'string' && props.loadError ? props.loadError : 'No se pudieron cargar las opciones.'
)

const emptyLabel = computed(() => props.placeholder ?? 'Seleccionar...')

/**
 * Config de HSSelect. Si `clearable`, NO seteamos `placeholder` en Preline: así la
 * opción vacía "Seleccionar…" queda como una opción normal (re-seleccionable) y el
 * usuario puede blanquear la selección. Si no, la vacía actúa de placeholder (Preline
 * la oculta una vez elegido un valor).
 */
const hsConfig = computed(() => JSON.stringify({
  ...(props.clearable ? {} : { placeholder: emptyLabel.value }),
  dropdownScope: 'window',
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'innertia-field hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative pe-9 flex gap-x-2 items-center text-nowrap cursor-pointer text-start',
  dropdownClasses: 'z-[10000] w-full max-h-72 py-1 bg-[color:var(--field-dropdown-bg)] border border-[color:var(--field-border)] rounded-control overflow-hidden overflow-y-auto shadow-lg',
  optionClasses: 'py-2 px-3 w-full text-sm text-foreground cursor-pointer bg-transparent hover:bg-muted-hover focus:outline-hidden focus:bg-muted-hover',
  optionTemplate: '<div class="flex justify-between items-center w-full"><span data-title></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-blue-600 dark:text-blue-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
}))

const selectRef = ref<HTMLSelectElement | null>(null)

/**
 * Init Preline HSSelect una sola vez después del mount. Para forzar un re-mount
 * limpio (ej. cambian las options), el consumer cambia el `:key` del componente.
 */
const initHsSelect = async () => {
  await nextTick()
  const el = selectRef.value
  if (!el) return

  const tryInit = (attempts = 0) => {
    const HSSelect = (window as any).HSSelect
    if (!HSSelect) {
      if (attempts < 20) {
        requestAnimationFrame(() => tryInit(attempts + 1))
      }
      return
    }
    if (HSSelect.getInstance?.(el)) return
    try {
      new HSSelect(el)
    } catch (e) {
      console.warn('[FormsSelect] HSSelect init falló:', e)
    }
  }

  tryInit()
}

onMounted(() => {
  initHsSelect()
})

const handleChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  emit('update:modelValue', val || null)
  emit('change', val || null)
}
</script>

<template>
  <div class="space-y-1.5">
    <!-- Label -->
    <label v-if="label" class="block text-sm font-medium text-foreground">
      {{ label }}
    </label>

    <!-- Cargando opciones desde BD -->
    <div v-if="loading" class="innertia-field flex items-center gap-2 text-muted-foreground cursor-default">
      <svg class="animate-spin size-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" opacity=".25" /><path d="M22 12a10 10 0 0 1-10 10" />
      </svg>
      <span class="text-sm">Cargando…</span>
    </div>

    <!-- Error al cargar opciones → botón reintentar -->
    <div v-else-if="loadError" class="innertia-field flex items-center justify-between gap-2 select-error">
      <span class="text-sm text-red-500 truncate">{{ loadErrorMessage }}</span>
      <button type="button" @click="emit('retry')"
        class="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.36 2.64L3 8" /><path d="M3 3v5h5" /></svg>
        Reintentar
      </button>
    </div>

    <!-- Select (HSSelect) -->
    <ClientOnly v-else>
      <template #fallback>
        <div class="innertia-field bg-surface animate-pulse" />
      </template>

      <div :class="['relative', error ? 'select-error' : '']">
        <select
          ref="selectRef"
          class="hs-select w-full"
          :value="modelValue ?? ''"
          :disabled="disabled"
          :data-hs-select="hsConfig"
          @change="handleChange"
        >
          <option value="">{{ emptyLabel }}</option>
          <option
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
    </ClientOnly>

    <!-- Error message -->
    <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

    <!-- Hint -->
    <p v-else-if="hint" class="text-xs text-muted-foreground">{{ hint }}</p>
  </div>
</template>

<style>
/*
 * Con `dropdownScope:'window'` Preline teletransporta el panel del dropdown al
 * <body> y lo posiciona con floating-ui (fixed + offset). Así escapa el overflow
 * de cualquier contenedor con scroll (modales, paneles, etc.) y flota por encima.
 */
</style>
