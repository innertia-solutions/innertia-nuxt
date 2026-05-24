<script setup>
const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    required: false,
    default: "sm",
    validator: (value) => ["xs", "sm", "md", "lg"].includes(value),
  },
  severity: {
    type: String,
    required: false,
    default: "secondary",
    validator: (value) =>
      ["primary", "secondary", "success", "danger", "warning", "info"].includes(
        value
      ),
  },
  outlined: {
    type: Boolean,
    required: false,
    default: false,
  },
  icon: {
    type: Object,
    required: false,
    default: null,
  },
  iconPosition: {
    type: String,
    required: false,
    default: "left",
    validator: (value) => ["left", "right"].includes(value),
  },
  class: {
    type: String,
    required: false,
    default: "",
  },
  iconClass: {
    type: String,
    required: false,
    default: "",
  },
  textClass: {
    type: String,
    required: false,
    default: "",
  },
  tooltip: {
    type: String,
    required: false,
    default: "",
  },
  tooltipPosition: {
    type: String,
    required: false,
    default: "top",
    validator: (value) =>
      ["top", "bottom", "left", "right", "auto"].includes(value),
  },
});

// Computed classes for sizes
const sizeClasses = computed(() => {
  const sizes = {
    xs: "px-1.5 py-0.5 text-xs",
    sm: "px-2 py-1.5 text-xs",
    md: "px-2.5 py-1.5 text-sm",
    lg: "px-3 py-2 text-sm",
  };
  return sizes[props.size] || sizes.sm;
});

// Computed classes for icon sizes
const iconSizeClasses = computed(() => {
  const sizes = {
    xs: "size-2.5",
    sm: "size-3",
    md: "size-3.5",
    lg: "size-4",
  };
  return sizes[props.size] || sizes.sm;
});

// Computed classes for severity colors
const severityClasses = computed(() => {
  const base = "font-light rounded-md";

  if (props.outlined) {
    const variants = {
      primary:
        "border border-blue-600 text-blue-600 bg-blue-50 dark:border-blue-500 dark:text-blue-500 dark:bg-blue-900/20",
      secondary:
        "border border-card-line text-muted-foreground-1 bg-card",
      success:
        "border border-green-600 text-green-600 bg-green-50 dark:border-green-500 dark:text-green-500 dark:bg-green-900/20",
      danger:
        "border border-red-600 text-red-600 bg-red-50 dark:border-red-500 dark:text-red-500 dark:bg-red-900/20",
      warning:
        "border border-yellow-500 text-yellow-600 bg-yellow-40 dark:border-yellow-500 dark:text-yellow-500 dark:bg-yellow-900/20",
      info: "border border-cyan-600 text-cyan-600 bg-cyan-50 dark:border-cyan-500 dark:text-cyan-500 dark:bg-cyan-900/20",
    };
    return `${base} ${variants[props.severity] || variants.secondary}`;
  } else {
    const variants = {
      primary: "bg-blue-600 text-white dark:bg-blue-600",
      secondary:
        "bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-neutral-200",
      success: "bg-green-600 text-white dark:bg-green-600",
      danger: "bg-red-600 text-white dark:bg-red-600",
      warning: "bg-yellow-600 text-white dark:bg-yellow-600",
      info: "bg-cyan-600 text-white dark:bg-cyan-600",
    };
    return `${base} ${variants[props.severity] || variants.secondary}`;
  }
});

// Tooltip attributes
const tooltipClasses = computed(() => {
  if (!props.tooltip) return "";

  const placement = `[--placement:${props.tooltipPosition}]`;
  return `hs-tooltip ${placement} inline-block`;
});

const tagClasses = computed(() => {
  const baseClasses = `${sizeClasses.value} ${severityClasses.value} inline-flex items-center gap-x-1 ${props.class}`;

  if (props.tooltip) {
    return `${baseClasses} hs-tooltip-toggle`;
  }

  return baseClasses;
});
</script>

<template>
  <div v-if="tooltip" :class="tooltipClasses">
    <span :class="tagClasses">
      <!-- Icon Left -->
      <component
        v-if="icon && iconPosition === 'left'"
        :is="icon"
        :class="`${iconSizeClasses} ${iconClass}`"
      />

      <!-- Tag Text -->
      <slot name="text">
        <span :class="textClass">{{ text }}</span>
      </slot>

      <!-- Icon Right -->
      <component
        v-if="icon && iconPosition === 'right'"
        :is="icon"
        :class="`${iconSizeClasses} ${iconClass}`"
      />

      <!-- Tooltip Content -->
      <span
        class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-gray-900 text-xs font-medium text-white rounded-md shadow-2xs dark:bg-neutral-700"
        role="tooltip"
      >
        {{ tooltip }}
      </span>
    </span>
  </div>

  <span v-else :class="tagClasses">
    <!-- Icon Left -->
    <component
      v-if="icon && iconPosition === 'left'"
      :is="icon"
      :class="`${iconSizeClasses} ${iconClass}`"
    />

    <!-- Tag Text -->
    <slot name="text">
      <span :class="textClass">{{ text }}</span>
    </slot>

    <!-- Icon Right -->
    <component
      v-if="icon && iconPosition === 'right'"
      :is="icon"
      :class="`${iconSizeClasses} ${iconClass}`"
    />
  </span>
</template>
