<script setup>
defineProps({
  title: { type: String, default: "No hay contenido" },
  description: { type: String, default: "Aún no hay datos que mostrar." },
  actionText: { type: String, default: "" },
  actionLink: { type: String, default: "" },
  showAction: { type: Boolean, default: false },
  shape: {
    type: String,
    default: "square",
    validator: (value) => ["square", "circle"].includes(value),
  },
});
</script>
<template>
  <div>
    <slot v-if="shape == 'square'" name="icon">
      <!-- Ícono por defecto (tu SVG) -->
      <svg
        class="w-48 mx-auto mb-4"
        width="178"
        height="90"
        viewBox="0 0 178 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="27"
          y="50.5"
          width="124"
          height="39"
          rx="7.5"
          fill="currentColor"
          class="fill-white dark:fill-slate-800"
        />
        <rect
          x="27"
          y="50.5"
          width="124"
          height="39"
          rx="7.5"
          stroke="currentColor"
          class="stroke-slate-50 dark:stroke-slate-700/10"
        />
        <rect
          x="34.5"
          y="58"
          width="24"
          height="24"
          rx="4"
          fill="currentColor"
          class="fill-slate-50 dark:fill-slate-700/30"
        />
        <rect
          x="66.5"
          y="61"
          width="60"
          height="6"
          rx="3"
          fill="currentColor"
          class="fill-slate-50 dark:fill-slate-700/30"
        />
        <rect
          x="66.5"
          y="73"
          width="77"
          height="6"
          rx="3"
          fill="currentColor"
          class="fill-slate-50 dark:fill-slate-700/30"
        />
        <rect
          x="19.5"
          y="28.5"
          width="139"
          height="39"
          rx="7.5"
          fill="currentColor"
          class="fill-white dark:fill-slate-800"
        />
        <rect
          x="19.5"
          y="28.5"
          width="139"
          height="39"
          rx="7.5"
          stroke="currentColor"
          class="stroke-slate-100 dark:stroke-slate-700/30"
        />
        <rect
          x="27"
          y="36"
          width="24"
          height="24"
          rx="4"
          fill="currentColor"
          class="fill-slate-100 dark:fill-slate-700/70"
        />
        <rect
          x="59"
          y="39"
          width="60"
          height="6"
          rx="3"
          fill="currentColor"
          class="fill-slate-100 dark:fill-slate-700/70"
        />
        <rect
          x="59"
          y="51"
          width="92"
          height="6"
          rx="3"
          fill="currentColor"
          class="fill-slate-100 dark:fill-slate-700/70"
        />
        <g filter="url(#filter15)">
          <rect
            x="12"
            y="6"
            width="154"
            height="40"
            rx="8"
            fill="currentColor"
            class="fill-white dark:fill-slate-800"
            shape-rendering="crispEdges"
          />
          <rect
            x="12.5"
            y="6.5"
            width="153"
            height="39"
            rx="7.5"
            stroke="currentColor"
            class="stroke-slate-100 dark:stroke-slate-700/60"
            shape-rendering="crispEdges"
          />
          <rect
            x="20"
            y="14"
            width="24"
            height="24"
            rx="4"
            fill="currentColor"
            class="fill-slate-200 dark:fill-slate-700"
          />
          <rect
            x="52"
            y="17"
            width="60"
            height="6"
            rx="3"
            fill="currentColor"
            class="fill-slate-200 dark:fill-slate-700"
          />
          <rect
            x="52"
            y="29"
            width="106"
            height="6"
            rx="3"
            fill="currentColor"
            class="fill-slate-200 dark:fill-slate-700"
          />
        </g>
        <defs>
          <filter
            id="filter15"
            x="0"
            y="0"
            width="178"
            height="64"
            filterUnits="userSpaceOnUse"
            color-interpolation-filters="sRGB"
          >
            <feFlood flood-opacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="6" />
            <feGaussianBlur stdDeviation="6" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0"
            />
            <feBlend
              mode="normal"
              in2="BackgroundImageFix"
              result="effect1_dropShadow_1187_14810"
            />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="effect1_dropShadow_1187_14810"
              result="shape"
            />
          </filter>
        </defs>
      </svg>
    </slot>
    <slot v-else name="icon">
      <svg
        class="w-48 mx-auto mb-4"
        width="178"
        height="90"
        viewBox="0 0 178 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="27"
          y="50.5"
          width="124"
          height="39"
          rx="7.5"
          fill="currentColor"
          class="fill-white dark:fill-slate-800"
        />
        <rect
          x="27"
          y="50.5"
          width="124"
          height="39"
          rx="7.5"
          stroke="currentColor"
          class="stroke-slate-50 dark:stroke-slate-700/10"
        />
        <rect
          x="34.5"
          y="58"
          width="24"
          height="24"
          rx="12"
          fill="currentColor"
          class="fill-slate-50 dark:fill-slate-700/30"
        />
        <rect
          x="66.5"
          y="61"
          width="60"
          height="6"
          rx="3"
          fill="currentColor"
          class="fill-slate-50 dark:fill-slate-700/30"
        />
        <rect
          x="66.5"
          y="73"
          width="77"
          height="6"
          rx="3"
          fill="currentColor"
          class="fill-slate-50 dark:fill-slate-700/30"
        />
        <rect
          x="19.5"
          y="28.5"
          width="139"
          height="39"
          rx="7.5"
          fill="currentColor"
          class="fill-white dark:fill-slate-800"
        />
        <rect
          x="19.5"
          y="28.5"
          width="139"
          height="39"
          rx="7.5"
          stroke="currentColor"
          class="stroke-slate-100 dark:stroke-slate-700/30"
        />
        <rect
          x="27"
          y="36"
          width="24"
          height="24"
          rx="12"
          fill="currentColor"
          class="fill-slate-100 dark:fill-slate-700/70"
        />
        <rect
          x="59"
          y="39"
          width="60"
          height="6"
          rx="3"
          fill="currentColor"
          class="fill-slate-100 dark:fill-slate-700/70"
        />
        <rect
          x="59"
          y="51"
          width="92"
          height="6"
          rx="3"
          fill="currentColor"
          class="fill-slate-100 dark:fill-slate-700/70"
        />
        <g filter="url(#filter4)">
          <rect
            x="12"
            y="6"
            width="154"
            height="40"
            rx="8"
            class="fill-white dark:fill-slate-800"
            shape-rendering="crispEdges"
          />
          <rect
            x="12.5"
            y="6.5"
            width="153"
            height="39"
            rx="7.5"
            stroke="currentColor"
            class="stroke-slate-100 dark:stroke-slate-700/60"
            shape-rendering="crispEdges"
          />
          <rect
            x="20"
            y="14"
            width="24"
            height="24"
            rx="12"
            fill="currentColor"
            class="fill-slate-200 dark:fill-slate-700"
          />
          <rect
            x="52"
            y="17"
            width="60"
            height="6"
            rx="3"
            fill="currentColor"
            class="fill-slate-200 dark:fill-slate-700"
          />
          <rect
            x="52"
            y="29"
            width="106"
            height="6"
            rx="3"
            fill="currentColor"
            class="fill-slate-200 dark:fill-slate-700"
          />
        </g>
        <defs>
          <filter
            id="filter4"
            x="0"
            y="0"
            width="178"
            height="64"
            filterUnits="userSpaceOnUse"
            color-interpolation-filters="sRGB"
          >
            <feFlood flood-opacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="6" />
            <feGaussianBlur stdDeviation="6" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0"
            />
            <feBlend
              mode="normal"
              in2="BackgroundImageFix"
              result="effect1_dropShadow_1187_14810"
            />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="effect1_dropShadow_1187_14810"
              result="shape"
            />
          </filter>
        </defs>
      </svg>
    </slot>

    <div class="max-w-sm mx-auto">
      <p class="mt-2 font-medium text-foreground">
        {{ title }}
      </p>
      <p class="mb-5 text-sm text-muted-foreground text-wrap">
        {{ description }}
      </p>
    </div>

    <a
      v-if="showAction"
      :href="actionLink"
      class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-card-line bg-card text-foreground shadow-2xs hover:bg-muted-hover focus:outline-hidden focus:bg-muted-hover"
    >
      {{ actionText }}
    </a>

    <template name="footer">
      <button
        type="button"
        class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        data-hs-overlay="#hs-pro-empty"
      >
        <svg
          class="hidden sm:block shrink-0 size-4"
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
          <path d="M5 12h14" />
          <path d="M12 5v14" /></svg
        >Add user
      </button>
    </template>
  </div>
</template>
