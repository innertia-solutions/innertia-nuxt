<script setup>
// Props
const props = defineProps({
  triggerText: {
    type: String,
    default: "Dropdown",
  },
  triggerLabel: {
    type: String,
    default: "Dropdown menu",
  },
  triggerClass: {
    type: String,
    default: "",
  },
  triggerSize: {
    type: String,
    default: "sm",
    validator: (value) => ["xs", "sm", "md", "lg"].includes(value),
  },
  triggerSeverity: {
    type: String,
    default: "secondary",
    validator: (value) =>
      ["primary", "secondary", "success", "danger", "warning", "info"].includes(
        value
      ),
  },
  triggerOutline: {
    type: Boolean,
    default: true,
  },
  wrapperClass: {
    type: String,
    default: "",
  },
  menuClass: {
    type: String,
    default: "",
  },
  placement: {
    type: String,
    default: "bottom-right",
    validator: (value) =>
      [
        "bottom",
        "bottom-left",
        "bottom-right",
        "top",
        "top-left",
        "top-right",
        "left",
        "right",
      ].includes(value),
  },
  items: {
    type: Array,
    default: () => [],
  },
  autoClose: {
    type: String,
    default: "true",
    validator: (value) =>
      ["true", "false", "inside", "outside"].includes(value),
  },
});

// Emits
const emit = defineEmits(["item-click", "open", "close"]);

// Reactive data
const triggerId = ref(
  `dropdown-trigger-${Math.random().toString(36).substr(2, 9)}`
);

// Computed
const triggerSizeClasses = computed(() => {
  const sizes = {
    xs: "py-0.5 px-2 text-xs font-light",
    sm: "py-1 px-2.5 text-sm font-light",
    md: "py-2.5 px-3 text-sm font-light",
    lg: "py-3 px-4 text-base font-light",
  };
  return sizes[props.triggerSize] || sizes.sm;
});

const triggerSeverityClasses = computed(() => {
  const base = "rounded-lg border transition-colors";
  const variants = {
    primary: props.triggerOutline
      ? "border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-500 dark:hover:bg-blue-900/20"
      : "border-transparent bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700",
    secondary: props.triggerOutline
      ? "border-card-line text-foreground hover:bg-muted-hover"
      : "border-transparent bg-muted text-foreground hover:bg-muted-hover",
    success: props.triggerOutline
      ? "border-green-600 text-green-600 hover:bg-green-50 dark:border-green-500 dark:text-green-500 dark:hover:bg-green-900/20"
      : "border-transparent bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700",
    danger: props.triggerOutline
      ? "border-red-600 text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-500 dark:hover:bg-red-900/20"
      : "border-transparent bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700",
    warning: props.triggerOutline
      ? "border-yellow-600 text-yellow-600 hover:bg-yellow-50 dark:border-yellow-500 dark:text-yellow-500 dark:hover:bg-yellow-900/20"
      : "border-transparent bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-600 dark:hover:bg-yellow-700",
    info: props.triggerOutline
      ? "border-cyan-600 text-cyan-600 hover:bg-cyan-50 dark:border-cyan-500 dark:text-cyan-500 dark:hover:bg-cyan-900/20"
      : "border-transparent bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-700",
  };

  return `${base} ${variants[props.triggerSeverity] || variants.secondary}`;
});

const triggerButtonClasses = computed(() => {
  const disabled = "disabled:opacity-50 disabled:pointer-events-none";
  const focus =
    "focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800";

  return `hs-dropdown-toggle ${triggerSizeClasses.value} ${triggerSeverityClasses.value} ${disabled} ${focus} inline-flex justify-center items-center gap-x-2 ${props.triggerClass}`;
});

const placementClass = computed(() => {
  const placements = {
    bottom: "[--placement:bottom]",
    "bottom-left": "[--placement:bottom-left]",
    "bottom-right": "[--placement:bottom-right]",
    top: "[--placement:top]",
    "top-left": "[--placement:top-left]",
    "top-right": "[--placement:top-right]",
    left: "[--placement:left]",
    right: "[--placement:right]",
  };
  return placements[props.placement] || "[--placement:bottom-left]";
});

const defaultItems = computed(() => {
  return props.items.length
    ? props.items
    : [
        {
          label: "Editar",
          type: "button",
          severity: "primary",
          action: () => {},
        },
        {
          label: "Duplicar",
          type: "button",
          severity: "success",
          action: () => {},
        },
        {
          label: "Eliminar",
          type: "button",
          severity: "danger",
          action: () => {},
        },
        { label: "Ver detalles", type: "link", href: "#" },
      ];
});

// Methods
const getItemButtonClasses = (item) => {
  const severity = item.severity || "default";

  const severityClasses = {
    default:
      "text-foreground hover:bg-muted-hover",
    primary:
      "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20",
    success:
      "text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20",
    danger:
      "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20",
    warning:
      "text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20",
    info: "text-cyan-600 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-900/20",
  };

  return severityClasses[severity] || severityClasses.default;
};

const toggleDropdown = () => {
  // Handled by Preline JS automatically
};

const closeDropdown = () => {
  // Handled by Preline JS automatically
};

const handleItemClick = (item, event) => {
  emit("item-click", { item, event });

  if (item.action && typeof item.action === "function") {
    item.action();
  }

  if (item.href === "#" || item.href === "") {
    event.preventDefault();
  }
};
</script>
<template>
  <div class="hs-dropdown relative inline-flex" :class="wrapperClass">
    <!-- Trigger button -->
    <button
      :id="triggerId"
      type="button"
      :class="triggerButtonClasses"
      aria-haspopup="menu"
      :aria-expanded="false"
      :aria-label="triggerLabel"
    >
      <slot name="trigger" :toggle="toggleDropdown">
        {{ triggerText }}
        <svg
          class="hs-dropdown-open:rotate-180 size-4 transition-transform duration-200"
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
          <path d="m6 9 6 6 6-6" />
        </svg>
      </slot>
    </button>

    <!-- Dropdown menu -->
    <div
      class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-40 bg-dropdown shadow-md rounded-lg p-1 space-y-0.5 mt-2 dark:border dark:border-dropdown-line dark:divide-card-line z-50 border border-dropdown-line"
      :class="[menuClass, placementClass]"
      role="menu"
      :aria-orientation="'vertical'"
      :aria-labelledby="triggerId"
    >
      <slot name="header" v-if="$slots.header"></slot>

      <slot name="items" :close="closeDropdown">
        <!-- Default items if no slot content provided -->
        <template v-for="(item, index) in defaultItems" :key="index">
          <!-- Button if type is button or has action -->
          <button
            v-if="item.type === 'button' || item.action"
            type="button"
            class="w-full flex items-center gap-x-3.5 py-2 px-3 rounded-lg text-sm transition-colors text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
            :class="[
              item.class || getItemButtonClasses(item),
              { 'opacity-50 pointer-events-none': item.disabled },
            ]"
            :disabled="item.disabled"
            @click="handleItemClick(item, $event)"
          >
            <component
              :is="item.icon"
              v-if="item.icon"
              class="size-4 shrink-0"
            />
            {{ item.label }}
          </button>

          <!-- Link if type is link or has href -->
          <a
            v-else
            class="flex items-center gap-x-3.5 py-2 px-3 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-foreground hover:bg-muted-hover"
            :class="item.class"
            :href="item.href || '#'"
            @click="handleItemClick(item, $event)"
          >
            <component
              :is="item.icon"
              v-if="item.icon"
              class="size-4 shrink-0"
            />
            {{ item.label }}
          </a>
        </template>
      </slot>

      <slot name="footer" v-if="$slots.footer"></slot>
    </div>
  </div>
</template>
