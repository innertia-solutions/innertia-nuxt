<script setup lang="ts">
const props = defineProps<{
  options: { value: string | number; label: string; disabled?: boolean }[]
  modelValue?: string | number | null
  label?: string
  placeholder?: string
  hint?: string
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  change: [value: string | number | null]
}>()

const selectRef = ref<HTMLSelectElement | null>(null)

/**
 * Init Preline HSSelect una sola vez después del mount.
 * No destruimos ni re-inicializamos en cambios de options — para forzar
 * un re-mount limpio, el consumer puede cambiar el `:key` del componente.
 *
 * Si Preline aún no está disponible (plugin carga async), esperamos.
 */
const initHsSelect = async () => {
  await nextTick()
  const el = selectRef.value
  if (!el) return

  const tryInit = (attempts = 0) => {
    const HSSelect = (window as any).HSSelect
    if (!HSSelect) {
      if (attempts < 20) {
        // Re-intentar hasta 20 frames (~330ms) esperando que cargue el plugin
        requestAnimationFrame(() => tryInit(attempts + 1))
      }
      return
    }

    // Evitar doble init si ya hay una instancia registrada
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

    <!-- Select (HSSelect) -->
    <ClientOnly>
      <template #fallback>
        <div class="innertia-field bg-surface animate-pulse" />
      </template>

      <div :class="['relative', error ? 'select-error' : '']">
        <select
          ref="selectRef"
          class="hs-select w-full"
          :value="modelValue ?? ''"
          :disabled="disabled"
          @change="handleChange"
          data-hs-select='{
            "placeholder": "Seleccionar...",
            "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
            "toggleClasses": "innertia-field hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 aria-expanded:!rounded-b-none aria-expanded:!border-b-transparent relative pe-9 flex gap-x-2 items-center text-nowrap cursor-pointer text-start",
            "dropdownClasses": "-mt-px z-50 w-full max-h-72 py-1 bg-[color:var(--field-dropdown-bg)] border border-[color:var(--field-border)] rounded-b-control overflow-hidden overflow-y-auto shadow-lg",
            "optionClasses": "py-2 px-3 w-full text-sm text-foreground cursor-pointer bg-transparent hover:bg-muted-hover focus:outline-hidden focus:bg-muted-hover",
            "optionTemplate": "<div class=\"flex justify-between items-center w-full\"><span data-title></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-blue-600 dark:text-blue-500\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>"
          }'
        >
          <option value="">{{ placeholder ?? 'Seleccionar...' }}</option>
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
 * Preline HSSelect: cuando el dropdown está abierto, el trigger pierde
 * sus esquinas inferiores y el borde inferior se vuelve invisible para
 * fusionarse visualmente con el dropdown panel.
 *
 * Estilos globales (sin scoped) porque el HSSelect inyecta DOM fuera
 * del componente Vue (button generado, no del template).
 */
.hs-select [aria-expanded="true"].innertia-field {
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  border-bottom-color: transparent !important;
}

/* Pegar el dropdown al trigger eliminando cualquier offset/margen que
 * Preline pueda inyectar. Target amplio: cualquier div con la clase
 * `rounded-b-control` dentro del wrapper `.hs-select`. */
.hs-select div[class*="rounded-b-control"] {
  top: 100% !important;
  margin-top: -1px !important;
}
</style>
