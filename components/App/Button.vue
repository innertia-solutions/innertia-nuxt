<script setup>
const props = defineProps({
  text: { type: String, required: true },
  size: { type: String, default: "sm", validator: (v) => ["xs","sm","md","lg"].includes(v) },
  class: { type: String, default: "" },
  iconClass: { type: String, default: "" },
  textClass: { type: String, default: "" },
  outline: { type: Boolean, default: false },
  severity: { type: String, default: "secondary", validator: (v) => ["primary","secondary","success","danger","warning","info"].includes(v) },
  icon: { type: [Object, Function], default: null },
  iconPosition: { type: String, default: "left", validator: (v) => ["left","right"].includes(v) },
  loading: { type: Boolean, default: false },
  loadingText: { type: String, default: "Cargando..." },
  disabled: { type: Boolean, default: false },
  type: { type: String, default: "button", validator: (v) => ["button","link"].includes(v) },
  link: { type: String, default: "" },
  variant: { type: String, default: "default", validator: (v) => ["default","dropdown"].includes(v) },
})

const sizeClasses = computed(() => ({ xs:"py-0.5 px-2 text-xs font-light", sm:"py-1 px-2.5 text-sm font-light", md:"py-2.5 px-3 text-sm font-light", lg:"py-3 px-4 text-base font-light" }[props.size] || "py-1 px-2.5 text-sm font-light"))
const iconSizeClasses = computed(() => ({ xs:"size-2", sm:"size-3", md:"size-4", lg:"size-5" }[props.size] || "size-3"))

const severityClasses = computed(() => {
  if (props.variant === "dropdown") {
    const d = { primary: "text-primary hover:bg-primary/10", secondary:"text-foreground hover:bg-muted-hover", success:"text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20", danger:"text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20", warning:"text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20", info:"text-cyan-600 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-900/20" }
    return d[props.severity] || d.secondary
  }
  const base = "rounded-lg border transition-colors"
  const v = { primary: "border-primary bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/15 dark:hover:bg-primary/25", secondary:"border-slate-300 bg-slate-50 text-slate-700 hover:bg-muted-hover dark:border-card-line dark:bg-card dark:text-muted-foreground-1 dark:hover:bg-muted-hover", success:"border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/35", danger:"border-red-600 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/35", warning:"border-yellow-600 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-500 dark:bg-yellow-900/20 dark:text-yellow-300 dark:hover:bg-yellow-900/35", info:"border-cyan-600 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-500 dark:bg-cyan-900/20 dark:text-cyan-300 dark:hover:bg-cyan-900/35" }
  return `${base} ${v[props.severity] || v.primary}`
})

const buttonClasses = computed(() => {
  if (props.variant === "dropdown") {
    const dis = props.type === "button" ? "disabled:opacity-50 disabled:pointer-events-none" : isDisabled.value ? "opacity-50 pointer-events-none" : ""
    return `w-full flex items-center gap-x-3.5 py-2 px-3 rounded-lg text-sm transition-colors text-left ${severityClasses.value} ${dis} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/40 dark:focus:ring-offset-gray-800 ${props.class}`
  }
  const dis = props.type === "button" ? "disabled:opacity-50 disabled:pointer-events-none" : isDisabled.value ? "opacity-50 pointer-events-none" : ""
  const cursor = props.type === "link" ? "cursor-pointer" : ""
  return `${sizeClasses.value} ${severityClasses.value} ${dis} focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-primary/40 dark:focus:ring-offset-gray-800 ${cursor} inline-flex justify-center items-center gap-x-2 whitespace-nowrap ${props.class}`
})

const displayText = computed(() => props.loading ? props.loadingText : props.text)
const isDisabled = computed(() => props.disabled || props.loading)
</script>
<template>
  <NuxtLink v-if="type === 'link'" :to="link" :class="buttonClasses">
    <div v-if="loading" :class="`animate-spin border-[2.5px] border-t-transparent rounded-full ${iconSizeClasses}`" :style="`border-color: currentColor; border-top-color: transparent`" role="status" />
    <component v-else-if="icon && iconPosition === 'left'" :is="icon" :class="variant === 'dropdown' ? 'size-4 shrink-0' : `${iconSizeClasses} ${iconClass}`" />
    <slot><span :class="textClass">{{ displayText }}</span></slot>
    <component v-if="!loading && icon && iconPosition === 'right'" :is="icon" :class="variant === 'dropdown' ? 'size-4 shrink-0' : `${iconSizeClasses} ${iconClass}`" />
  </NuxtLink>
  <button v-else :disabled="isDisabled" :class="buttonClasses" type="button">
    <div v-if="loading" :class="`animate-spin border-[2.5px] border-t-transparent rounded-full ${iconSizeClasses}`" :style="`border-color: currentColor; border-top-color: transparent`" role="status" />
    <component v-else-if="icon && iconPosition === 'left'" :is="icon" :class="variant === 'dropdown' ? 'size-4 shrink-0' : `${iconSizeClasses} ${iconClass}`" />
    <slot><span :class="textClass">{{ displayText }}</span></slot>
    <component v-if="!loading && icon && iconPosition === 'right'" :is="icon" :class="variant === 'dropdown' ? 'size-4 shrink-0' : `${iconSizeClasses} ${iconClass}`" />
  </button>
</template>
