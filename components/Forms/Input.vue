<script setup lang="ts">
import { ref, computed } from 'vue'
import { IconEye, IconEyeOff } from '@tabler/icons-vue'

const props = defineProps<{
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
  placeholder?: string
  disabled?: boolean
  error?: string | null
  label?: string
  hint?: string
  iconLeft?: object | Function | null
  autocomplete?: string
  size?: 'sm' | 'md'
}>()

const modelValue = defineModel<string | number | null>({ default: '' })

const showPassword = ref(false)

const inputType = computed(() => {
  if (props.type === 'password') return showPassword.value ? 'text' : 'password'
  return props.type ?? 'text'
})

const baseClasses = computed(() =>
  `${props.size === 'sm' ? 'py-1.5' : 'py-2'} px-3 block w-full rounded-lg text-sm text-slate-800 border border-card-line focus:ring-0 focus:border-gray-400 focus:outline-none disabled:opacity-50 dark:bg-transparent dark:text-muted-foreground-1 transition-colors placeholder:text-muted-foreground dark:placeholder:text-muted-foreground`
)
</script>

<template>
  <div class="w-full">
    <label v-if="label" class="block text-sm font-medium text-foreground mb-1.5">
      {{ label }}
    </label>

    <div class="relative">
      <!-- Ícono izquierdo -->
      <div v-if="iconLeft" class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-muted-foreground">
        <component :is="iconLeft" class="size-4" />
      </div>

      <input
        v-model="modelValue"
        :type="inputType"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :class="[
          baseClasses,
          iconLeft ? 'ps-9' : '',
          type === 'password' ? 'pe-10' : '',
          error ? '!border-red-400 dark:!border-red-500' : '',
        ]"
      />

      <!-- Toggle contraseña -->
      <button
        v-if="type === 'password'"
        type="button"
        tabindex="-1"
        class="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-muted-foreground-1 transition-colors"
        @click="showPassword = !showPassword"
      >
        <component :is="showPassword ? IconEyeOff : IconEye" class="size-4" />
      </button>
    </div>

    <!-- Error -->
    <p v-if="error" class="text-xs text-red-500 dark:text-red-400 mt-1">{{ error }}</p>

    <!-- Hint -->
    <p v-else-if="hint" class="text-xs text-muted-foreground mt-1">{{ hint }}</p>
  </div>
</template>
