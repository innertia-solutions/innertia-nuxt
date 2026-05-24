<script setup>
const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: null,
  },
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: "Seleccionar...",
  },
  optionLabelKey: {
    type: String,
    default: "label",
  },
  optionValueKey: {
    type: String,
    default: "value",
  },
  clearable: {
    type: Boolean,
    default: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  menuClass: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue", "change"]);

const isOpen = ref(false);
const dropdownRef = ref(null);

const getOptionLabel = (option) => option?.[props.optionLabelKey] ?? option?.label ?? "";
const getOptionValue = (option) => option?.[props.optionValueKey] ?? option?.value ?? null;

const hasSelection = computed(() => props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== "");

const selectedOption = computed(() =>
  props.options.find((option) => getOptionValue(option) === props.modelValue),
);

const displayText = computed(() => {
  if (!selectedOption.value) return props.placeholder;
  return getOptionLabel(selectedOption.value) || props.placeholder;
});

const selectClasses = computed(() => {
  const base =
    "relative w-full rounded-lg border bg-card transition-colors cursor-pointer text-foreground py-2 px-3 text-sm focus:outline-none focus:ring-0 focus:border-gray-400";
  const validation = "border-card-line";
  const disabled = props.disabled ? "opacity-50 cursor-not-allowed" : "";
  return `${base} ${validation} ${disabled}`;
});

const closeDropdown = () => {
  isOpen.value = false;
};

const toggleDropdown = () => {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
};

const selectOption = (option) => {
  const selectedValue = getOptionValue(option);
  const nextValue = props.modelValue === selectedValue ? null : selectedValue;
  emit("update:modelValue", nextValue);
  emit("change", nextValue);
  closeDropdown();
};

const clearSelection = () => {
  emit("update:modelValue", null);
  emit("change", null);
  closeDropdown();
};

const isOptionSelected = (option) => getOptionValue(option) === props.modelValue;

const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    closeDropdown();
  }
};

onMounted(() => document.addEventListener("mousedown", handleClickOutside));
onUnmounted(() => document.removeEventListener("mousedown", handleClickOutside));
</script>

<template>
  <div ref="dropdownRef" class="relative w-full">
    <button
      type="button"
      :class="selectClasses"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-haspopup="true"
      @click="toggleDropdown"
    >
      <div class="flex items-center justify-between w-full">
        <span
          class="truncate flex-1 text-left pr-10"
          :class="{
            'text-muted-foreground': !hasSelection,
            'text-slate-900 dark:text-white': hasSelection,
          }"
        >
          <slot name="display" :selected-option="selectedOption" :display-text="displayText">
            {{ displayText }}
          </slot>
        </span>

        <span
          v-if="clearable && hasSelection && !disabled"
          class="absolute end-8 top-1/2 -translate-y-1/2 hover:bg-muted-hover rounded-full p-1 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400"
          role="button"
          tabindex="0"
          @click.stop="clearSelection"
          @keydown.enter.prevent="clearSelection"
          @keydown.space.prevent="clearSelection"
        >
          <svg class="size-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </span>

        <div class="absolute top-1/2 end-3 -translate-y-1/2">
          <svg
            class="shrink-0 size-3.5 text-muted-foreground transition-transform"
            :class="{ 'rotate-180': isOpen }"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m7 15 5 5 5-5" />
            <path d="m7 9 5-5 5 5" />
          </svg>
        </div>
      </div>
    </button>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-show="isOpen"
        :class="[
          'absolute z-50 w-full mt-1 bg-dropdown border border-dropdown-line rounded-xl shadow-xl max-h-60 overflow-auto',
          menuClass,
        ]"
      >
        <div v-if="options.length">
          <button
            v-for="option in options"
            :key="getOptionValue(option)"
            type="button"
            :class="[
              'w-full px-3 py-2 text-left hover:bg-muted-hover flex items-center text-sm',
              isOptionSelected(option) ? 'bg-muted' : '',
            ]"
            @click="selectOption(option)"
          >
            <slot name="option" :option="option" :selected="isOptionSelected(option)">
              <div class="flex items-center flex-1 min-w-0">
                <span
                  v-if="option.dot"
                  class="relative flex-shrink-0 size-2.5 flex items-center justify-center mr-2.5"
                >
                  <span
                    v-if="option.pulse"
                    :class="['animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', option.dot]"
                  />
                  <span :class="['relative inline-flex rounded-full size-2.5', option.dot]" />
                </span>
                <span class="font-bold text-foreground truncate">
                  {{ getOptionLabel(option) }}
                </span>
              </div>
            </slot>

            <svg
              v-if="isOptionSelected(option)"
              class="w-4 h-4 text-slate-500 ml-2 shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div v-else class="px-3 py-4 text-center text-muted-foreground text-sm">
          Sin opciones
        </div>
      </div>
    </Transition>
  </div>
</template>
