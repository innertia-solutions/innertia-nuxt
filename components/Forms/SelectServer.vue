<script setup>
// Props del componente
const props = defineProps({
  // Endpoint para la carga desde API
  endpoint: { type: String, required: true },
  listFormat: { type: Boolean, default: true },
  perPage: { type: Number, default: 15 },
  initialOptions: { type: Array, default: () => [] },

  // v-model
  modelValue: { type: [String, Number, Array, Object], default: null },

  // Form wrapper
  label: { type: String, default: "" },
  placeholder: { type: String, default: "Seleccionar..." },
  hint: { type: String, default: "" },
  error: { type: String, default: "" },

  // Functional
  multiple: { type: Boolean, default: false },
  searchable: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  name: { type: String, default: "" },
  clearable: { type: Boolean, default: false },
  searchPlaceholder: { type: String, default: "Buscar..." },
  minSearchLength: { type: Number, default: 0 },
  tagsMode: { type: Boolean, default: false },
  showCounter: { type: Boolean, default: false },
  maxSelection: { type: Number, default: 0 },
  allowEmpty: { type: Boolean, default: true },
  closeOnSelect: { type: Boolean, default: true },

  // Claves de campo
  labelKey: { type: String, default: "name" },
  valueKey: { type: String, default: "id" },
  descriptionKey: { type: String, default: "description" },
});

// Emits
const emit = defineEmits(["update:modelValue", "blur", "change", "search", "clear"]);

// Reactive state
const isOpen = ref(false);
const searchQuery = ref("");
const selectRef = ref(null);
const optionsListRef = ref(null);
const selectedOptions = ref([]);
const focusedIndex = ref(-1);

// SSR Data
const isFetching = ref(false);
const currentPage = ref(1);
const hasMorePages = ref(true);
const serverOptions = ref([...props.initialOptions]);

const fetchOptions = async (page = 1, query = "") => {
  if (isFetching.value || (!hasMorePages.value && page > 1)) return;

  isFetching.value = true;
  currentPage.value = page;

  try {
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: props.perPage.toString(),
    });

    if (query) {
      params.append('search', query);
    }

    if (props.listFormat) {
      params.append('list', 'true');
    }

    const api = useApi();
    const { data, error } = await api.get(`${props.endpoint}?${params.toString()}`);

    if (!error && data) {
      let newItems = [];
      let meta = null;

      if (data.data && Array.isArray(data.data)) {
        newItems = data.data;
        meta = data.meta;
      } else if (Array.isArray(data)) {
        newItems = data;
      }

      if (page === 1) {
        serverOptions.value = newItems;
        hasMorePages.value = meta ? meta.current_page < meta.last_page : newItems.length >= props.perPage;
      } else {
        const existingIds = new Set(serverOptions.value.map(opt => opt.id));
        const nonDuplicateItems = newItems.filter(opt => !existingIds.has(opt.id));
        serverOptions.value = [...serverOptions.value, ...nonDuplicateItems];

        if (nonDuplicateItems.length === 0 && newItems.length > 0) {
          hasMorePages.value = false;
        } else {
          hasMorePages.value = meta ? meta.current_page < meta.last_page : newItems.length >= props.perPage;
        }
      }
    }
  } catch (err) {
    // silently handle fetch errors
  } finally {
    isFetching.value = false;
  }
};

let debounceTimer = null;
const handleSearchInput = (event) => {
  searchQuery.value = event.target.value;
  emit("search", searchQuery.value);

  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    if (searchQuery.value.length === 0 || searchQuery.value.length >= props.minSearchLength) {
      fetchOptions(1, searchQuery.value);
      if (optionsListRef.value) {
        optionsListRef.value.scrollTop = 0;
      }
    }
  }, 300);
};

const clearSearch = () => {
  searchQuery.value = "";
  emit("search", "");
  fetchOptions(1, "");
};

// Infinite scroll
const handleScroll = (event) => {
  const container = event.target;
  if (container.scrollHeight - container.scrollTop <= container.clientHeight + 50) {
    if (!isFetching.value && hasMorePages.value) {
      fetchOptions(currentPage.value + 1, searchQuery.value);
    }
  }
};

// Initial load
onMounted(() => {
  if (props.initialOptions && props.initialOptions.length > 0) {
    serverOptions.value = [...props.initialOptions];
  }
});

// Model value handling
const localValue = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit("update:modelValue", value);
    emit("change", value);
    nextTick(() => {
      if (!props.name || !selectRef?.value) return;
      const hidden = selectRef.value.querySelector(
        `input[type="hidden"][name="${props.name}"]`
      );
      if (!hidden) return;
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    });
  },
});

// Initialize selected options
watch(
  () => props.modelValue,
  (newValue) => {
    if (!serverOptions.value || serverOptions.value.length === 0) {
      return;
    }

    try {
      if (props.multiple && Array.isArray(newValue)) {
        selectedOptions.value = newValue
          .map((val) => {
            try {
              return serverOptions.value.find(
                (opt) => getOptionValue(opt) === val || opt.id === val
              );
            } catch (error) {
              return serverOptions.value.find((opt) => opt.id === val);
            }
          })
          .filter(Boolean);
      } else if (!props.multiple && newValue !== null && newValue !== undefined) {
        try {
          const option = serverOptions.value.find(
            (opt) => getOptionValue(opt) === newValue || opt.id === newValue
          );
          selectedOptions.value = option ? [option] : [];
        } catch (error) {
          const option = serverOptions.value.find((opt) => opt.id === newValue);
          selectedOptions.value = option ? [option] : [];
        }
      } else {
        selectedOptions.value = [];
      }
    } catch (error) {
      selectedOptions.value = [];
    }
  },
  { immediate: true }
);

// Watch para cuando las opciones (serverOptions) cambien
watch(
  () => serverOptions.value,
  (newOptions) => {
    if (newOptions && newOptions.length > 0 && props.modelValue) {
      nextTick(() => {
        const currentValue = props.modelValue;
        if (currentValue) {
          try {
            if (props.multiple && Array.isArray(currentValue)) {
              selectedOptions.value = currentValue
                .map((val) => {
                  try {
                    const existing = selectedOptions.value.find(s => getOptionValue(s) === val);
                    const found = serverOptions.value.find(
                      (opt) => getOptionValue(opt) === val || opt.id === val
                    );
                    return found || existing;
                  } catch (error) {
                    return serverOptions.value.find((opt) => opt.id === val);
                  }
                })
                .filter(Boolean);
            } else if (!props.multiple && currentValue !== null && currentValue !== undefined) {
              try {
                const existing = selectedOptions.value.find(s => getOptionValue(s) === currentValue);
                const found = serverOptions.value.find(
                  (opt) => getOptionValue(opt) === currentValue || opt.id === currentValue
                );
                selectedOptions.value = (found || existing) ? [found || existing] : [];
              } catch (error) {
                const found = serverOptions.value.find((opt) => opt.id === currentValue);
                selectedOptions.value = found ? [found] : [];
              }
            }
          } catch (error) {
            // silently handle
          }
        }
      });
    }
  },
  { deep: true }
);

// Helper functions para extraer valores dinámicamente
const getOptionLabel = (option) => {
  if (props.labelKey === "key" && option.key) {
    return option.key;
  }
  if (props.labelKey === "label" && option.label) {
    return option.label;
  }
  if (props.labelKey === "name" && option.name) {
    return option.name;
  }
  if (props.labelKey.includes(".")) {
    const keys = props.labelKey.split(".");
    let result = option;
    for (const key of keys) {
      result = result?.[key];
    }
    return result || option.key || option.label || option.name || "";
  }
  return (
    option[props.labelKey] ||
    option.label ||
    option.key ||
    option.name ||
    option.value ||
    ""
  );
};

const getOptionValue = (option) => {
  if (props.valueKey === "id" && option.id) {
    return option.id;
  }
  if (props.valueKey === "value" && option.value !== undefined) {
    return option.value;
  }
  if (props.valueKey === "key" && option.key) {
    return option.key;
  }
  if (props.valueKey.includes(".")) {
    const keys = props.valueKey.split(".");
    let result = option;
    for (const key of keys) {
      result = result?.[key];
    }
    return result;
  }
  return option[props.valueKey] || option.value || option.id || option.key;
};

const getOptionDescription = (option) => {
  if (!props.descriptionKey) return "";
  if (props.descriptionKey.includes(".")) {
    const keys = props.descriptionKey.split(".");
    let result = option;
    for (const key of keys) {
      result = result?.[key];
    }
    return result || "";
  }
  return option[props.descriptionKey] || option.description || "";
};

// Computed classes for sizes
const sizeClasses = computed(() => {
  const sizes = {
    xs: "py-1.5 px-3 text-xs",
    sm: "py-2 px-3 text-sm",
    md: "py-2 px-3 text-sm",
    lg: "py-3 px-3 text-base",
  };
  return sizes[props.size] || sizes.sm;
});

// Computed classes for validation states
const validationClasses = computed(() => {
  if (props.error) return "border-red-400 dark:border-red-500";
  return "border-card-line";
});

// Combined select classes
const selectClasses = computed(() => {
  // Apariencia unificada con el resto de los fields del DS.
  // En modo tags-multiple desactivamos la altura fija porque el control crece
  // según la cantidad de chips seleccionados.
  const base = props.multiple && props.tagsMode
    ? "innertia-field relative cursor-pointer text-start !ps-3.5 !pe-9 flex items-center flex-wrap gap-2 text-nowrap !h-auto min-h-[var(--field-height)] py-2.5"
    : "innertia-field relative cursor-pointer text-start pe-9 flex items-center gap-x-2";

  // Cuando el dropdown está abierto, el trigger se "funde" visualmente con
  // el panel: deja de redondear sus esquinas inferiores y queda como una sola pieza.
  const openStyles = isOpen.value
    ? "!rounded-b-none border-b-transparent"
    : "";

  const disabled = props.disabled || props.loading ? "opacity-50 cursor-not-allowed" : "";

  return `${base} ${openStyles} ${validationClasses.value} ${disabled} ${props.class ?? ""}`;
});

// Filtered options — backend does the filtering, serverOptions IS the filteredOptions
const filteredOptions = computed(() => {
  return serverOptions.value;
});

// Display text for selected values
const displayText = computed(() => {
  if (props.loading) return "Cargando...";

  if (!selectedOptions.value.length) return props.placeholder;

  if (props.multiple) {
    if (props.showCounter && selectedOptions.value.length > 1) {
      return `${selectedOptions.value.length} seleccionados`;
    }
    if (props.tagsMode) {
      return selectedOptions.value.map((opt) => getOptionLabel(opt)).join(", ");
    }
    return selectedOptions.value.map((opt) => getOptionLabel(opt)).join(", ");
  }

  return getOptionLabel(selectedOptions.value[0]) || props.placeholder;
});

const toggleSelect = async () => {
  if (props.disabled || props.loading) return;
  isOpen.value = !isOpen.value;

  if (isOpen.value) {
    if (serverOptions.value.length <= (props.initialOptions?.length || 0) && !searchQuery.value && !isFetching.value) {
      await fetchOptions(1);
    }

    if (props.searchable) {
      nextTick(() => {
        const searchInput = selectRef.value?.querySelector(
          'input[type="search"]'
        );
        searchInput?.focus();
      });
    }
  }
};

const selectOption = (option) => {
  if (option.disabled) return;

  if (props.multiple) {
    const target = getOptionValue(option);
    const index = selectedOptions.value.findIndex(
      (opt) => getOptionValue(opt) === target
    );
    if (index > -1) {
      selectedOptions.value.splice(index, 1);
    } else {
      if (
        props.maxSelection === 0 ||
        selectedOptions.value.length < props.maxSelection
      ) {
        selectedOptions.value.push(option);
      }
    }
    localValue.value = selectedOptions.value.map((opt) => getOptionValue(opt));
  } else {
    selectedOptions.value = [option];
    localValue.value = getOptionValue(option);
    if (props.closeOnSelect) {
      isOpen.value = false;
    }
  }
};

const removeTag = (option) => {
  if (props.disabled) return;
  const target = getOptionValue(option);
  const index = selectedOptions.value.findIndex((opt) => getOptionValue(opt) === target);
  if (index > -1) {
    selectedOptions.value.splice(index, 1);
    localValue.value = selectedOptions.value.map((opt) => getOptionValue(opt));
  }
};

const clearSelection = () => {
  if (props.disabled) return;
  selectedOptions.value = [];
  localValue.value = props.multiple ? [] : null;
  emit("clear");
};

const isOptionSelected = (option) => {
  const target = getOptionValue(option);
  return selectedOptions.value.some((opt) => getOptionValue(opt) === target);
};

// Keyboard navigation
const handleKeydown = (event) => {
  if (props.disabled || props.loading) return;

  switch (event.key) {
    case "Enter":
    case " ":
      event.preventDefault();
      if (!isOpen.value) {
        toggleSelect();
      } else if (
        focusedIndex.value >= 0 &&
        filteredOptions.value[focusedIndex.value]
      ) {
        selectOption(filteredOptions.value[focusedIndex.value]);
      }
      break;
    case "Escape":
      isOpen.value = false;
      break;
    case "ArrowDown":
      event.preventDefault();
      if (!isOpen.value) {
        toggleSelect();
      } else {
        focusedIndex.value = Math.min(
          focusedIndex.value + 1,
          filteredOptions.value.length - 1
        );
      }
      break;
    case "ArrowUp":
      event.preventDefault();
      if (isOpen.value) {
        focusedIndex.value = Math.max(focusedIndex.value - 1, -1);
      }
      break;
  }
};

// Click outside to close
onMounted(() => {
  document.addEventListener("click", (event) => {
    if (selectRef.value && !selectRef.value.contains(event.target)) {
      isOpen.value = false;
    }
  });
});
</script>

<template>
  <div class="space-y-1.5">
    <!-- Label -->
    <label v-if="label" class="block text-sm font-medium text-foreground">
      {{ label }}
    </label>

  <div class="relative" ref="selectRef">
    <!-- Hidden input for form integration -->
    <input v-if="name" type="hidden" :name="name" :value="multiple
      ? Array.isArray(modelValue)
        ? modelValue.join(',')
        : ''
      : modelValue || ''
      " />

    <!-- Select button/trigger -->
    <button type="button" :class="selectClasses" @click="toggleSelect" @keydown="handleKeydown"
      :disabled="disabled || loading" :aria-expanded="isOpen" :aria-haspopup="true" :name="name">
      <!-- Loading spinner -->
      <div v-if="loading" class="flex items-center">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
        <span>Cargando...</span>
      </div>

      <!-- Selected values display -->
      <div v-else class="flex items-center justify-between w-full">
        <!-- Tags mode for multiple selection -->
        <div v-if="multiple && tagsMode && selectedOptions.length" class="flex flex-wrap items-center gap-1.5 flex-1">
          <div v-for="option in selectedOptions" :key="option.id"
            class="inline-flex items-center gap-1.5 bg-muted border border-[color:var(--field-border)] rounded-badge ps-2.5 pe-1 py-1 text-xs leading-none">
            <!-- Avatar/Icon -->
            <div v-if="option.avatar || option.icon" class="size-4">
              <img v-if="option.avatar" :src="option.avatar" :alt="getOptionLabel(option)"
                class="inline-block rounded-avatar size-4" />
              <div v-else-if="option.icon" v-html="option.icon" class="size-4"></div>
            </div>

            <!-- Label -->
            <span class="whitespace-nowrap text-foreground">
              <slot name="tag" :option="option">
                {{ getOptionLabel(option) }}
              </slot>
            </span>

            <!-- Remove button -->
            <button type="button" v-if="!disabled" @click.stop="removeTag(option)"
              class="inline-flex shrink-0 justify-center items-center size-4 rounded-badge text-muted-foreground hover:text-foreground focus:outline-none focus-visible:outline-none cursor-pointer"
              tabindex="-1">
              <svg class="shrink-0 size-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <span v-if="!selectedOptions.length" class="text-muted-foreground py-2.5 px-2">
            {{ placeholder }}
          </span>
        </div>

        <span v-else class="truncate flex-1 text-left pr-10"
          :class="{ 'text-muted-foreground': !selectedOptions.length, 'text-foreground': selectedOptions.length }">
          <slot name="display" :selectedOptions="selectedOptions" :displayText="displayText">
            {{ displayText }}
          </slot>
        </span>

        <!-- Clear button -->
        <button type="button" v-if="clearable && selectedOptions.length && !disabled && !loading"
          @click.stop="clearSelection"
          class="absolute end-8 top-1/2 -translate-y-1/2 hover:bg-muted-hover rounded-full p-1 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400">
          <svg class="size-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"></path>
          </svg>
        </button>

        <!-- Dropdown arrow -->
        <div class="absolute top-1/2 end-3 -translate-y-1/2">
          <svg class="shrink-0 size-3.5 text-muted-foreground transition-transform"
            :class="{ 'rotate-180': isOpen }" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="m7 15 5 5 5-5" />
            <path d="m7 9 5-5 5 5" />
          </svg>
        </div>
      </div>
    </button>

    <!-- Dropdown menu -->
    <Transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
      <div v-show="isOpen" ref="optionsListRef" @scroll="handleScroll"
        class="absolute z-50 w-full -mt-px bg-[color:var(--field-dropdown-bg)] border border-[color:var(--field-border)] rounded-b-control shadow-lg max-h-60 overflow-auto">
        <!-- Search input -->
        <div v-if="searchable" class="p-2 border-b border-card-line relative">
          <input type="text" :value="searchQuery" :placeholder="searchPlaceholder" @input="handleSearchInput"
            @keydown.enter.prevent
            class="innertia-field innertia-field-sm pe-8" />
          <button type="button" v-if="searchQuery" @click.prevent="clearSearch"
            class="absolute top-1/2 right-4 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Initial Loader if list is empty -->
        <div v-if="isFetching && filteredOptions.length === 0" class="px-3 py-6 text-center text-muted-foreground">
          <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-current mx-auto mb-2"></div>
          <span class="text-sm">Buscando...</span>
        </div>

        <!-- Empty option -->
        <button type="button" v-if="allowEmpty && !multiple && !isFetching && filteredOptions.length" @click="
          selectOption({ id: '__empty__', value: null, label: 'Ninguno' })
          " class="w-full px-3 py-2 text-left hover:bg-muted-hover text-sm">
          <slot name="empty-option">
            <span class="text-muted-foreground">Ninguno</span>
          </slot>
        </button>

        <!-- Options list -->
        <div v-if="filteredOptions.length">
          <button type="button" v-for="(option, index) in filteredOptions" :key="option.id"
            @click="selectOption(option)" :class="[
              'w-full px-3 py-2 text-left hover:bg-muted-hover flex items-center text-sm',
              {
                'bg-muted': isOptionSelected(option),
                'opacity-50 cursor-not-allowed': option.disabled,
                'bg-surface': focusedIndex === index,
              },
            ]" :disabled="option.disabled">
            <!-- Multiple selection checkbox -->
            <div v-if="multiple" class="mr-2">
              <div :class="[
                'w-4 h-4 rounded-control border-2 flex items-center justify-center',
                isOptionSelected(option)
                  ? 'bg-slate-600 border-slate-600 text-white'
                  : 'border-card-line',
              ]">
                <svg v-if="isOptionSelected(option)" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"></path>
                </svg>
              </div>
            </div>

            <!-- Option content -->
            <div class="flex items-center flex-1">
              <!-- Avatar/Icon -->
              <div v-if="option.avatar || option.icon" class="mr-3">
                <img v-if="option.avatar" :src="option.avatar" :alt="option.label" class="w-6 h-6 rounded-avatar" />
                <component v-else-if="option.icon" :is="option.icon" class="w-5 h-5 text-gray-500" />
              </div>

              <!-- Option text -->
              <div class="flex-1">
                <slot name="option" :option="option" :selected="isOptionSelected(option)">
                  <div>
                    <div class="font-bold text-foreground">
                      {{ getOptionLabel(option) }}
                    </div>
                    <div v-if="getOptionDescription(option)"
                      class="text-[10px] text-muted-foreground uppercase tracking-tight">
                      {{ getOptionDescription(option) }}
                    </div>
                  </div>
                </slot>
              </div>

              <!-- Selection indicator for single mode -->
              <div v-if="!multiple && isOptionSelected(option)" class="ml-2">
                <svg class="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"></path>
                </svg>
              </div>
            </div>
          </button>
        </div>

        <!-- Infinite Scroll Mini Loader -->
        <div v-if="isFetching && filteredOptions.length > 0" class="py-3 text-center border-t border-card-line">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400 mx-auto"></div>
        </div>

        <!-- End of list marker -->
        <div v-else-if="!hasMorePages && filteredOptions.length > 0" class="py-2 text-center text-[10px] text-muted-foreground uppercase tracking-widest border-t border-card-line">
          No hay más opciones
        </div>

        <!-- No options message -->
        <div v-else-if="!isFetching && searchQuery && filteredOptions.length === 0"
          class="px-3 py-4 text-center text-muted-foreground text-sm">
          <slot name="no-options"> No se encontraron opciones </slot>
        </div>

        <!-- No data message -->
        <div v-else-if="!serverOptions.length && !isFetching" class="px-3 py-8 text-center">
          <div class="flex flex-col items-center gap-y-2">
            <div class="size-10 rounded-avatar bg-muted flex items-center justify-center">
              <svg class="size-5 text-muted-foreground-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <p class="text-sm font-bold text-muted-foreground">No hay datos disponibles</p>
            <p class="text-[10px] text-muted-foreground-2 uppercase font-black tracking-widest">Intenta refrescar la página</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Validation messages -->
  </div>

    <!-- Error / Hint -->
    <p v-if="error" class="text-xs text-red-500 dark:text-red-400">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-muted-foreground">{{ hint }}</p>
  </div>
</template>
