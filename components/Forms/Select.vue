<script setup lang="ts">
const props = defineProps<{
  options: { value: string | number; label: string }[]
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

const reinitHsSelect = async () => {
  await nextTick()
  const el = selectRef.value
  if (!el) return

  const instance = (window as any).HSSelect?.getInstance?.(el)
  if (instance?.destroy) instance.destroy()

  new (window as any).HSSelect(el)
}

// Re-initialize when options change (async load)
watch(() => props.options, async () => {
  await reinitHsSelect()
}, { deep: true })

onMounted(() => {
  reinitHsSelect()
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
        <div class="h-[38px] bg-surface animate-pulse rounded-lg" />
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
            "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-2 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-card border border-card-line rounded-lg text-start text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-muted-foreground-1 dark:focus:outline-hidden dark:focus:ring-1 dark:focus:ring-blue-600",
            "dropdownClasses": "mt-1 z-50 w-full max-h-72 p-1 space-y-0.5 bg-dropdown border border-dropdown-line rounded-lg overflow-hidden overflow-y-auto shadow-lg",
            "optionClasses": "py-2 px-4 w-full text-sm text-foreground cursor-pointer hover:bg-muted-hover rounded-lg focus:outline-hidden focus:bg-muted-hover dark:bg-card",
            "optionTemplate": "<div class=\"flex justify-between items-center w-full\"><span data-title></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-blue-600 dark:text-blue-500\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>"
          }'
        >
          <option value="">{{ placeholder ?? 'Seleccionar...' }}</option>
          <option
            v-for="option in options"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
    </ClientOnly>

    <!-- Error -->
    <p v-if="error" class="text-xs text-red-500 dark:text-red-400">{{ error }}</p>

    <!-- Hint -->
    <p v-else-if="hint" class="text-xs text-muted-foreground">{{ hint }}</p>
  </div>
</template>

<style scoped>
/* Apply error border to the HSSelect toggle button when in error state */
.select-error :deep(button[aria-expanded]) {
  border-color: rgb(248 113 113) !important; /* red-400 */
}
</style>
