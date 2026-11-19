<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveBrandingPreview, type BrandingFields, type ResolvedBranding } from '../../composables/internal/mailBranding'

/*
 * Mail.BrandingPreview — vista previa en vivo de un correo con la marca (logo/nombre, color del
 * botón, pie y "Enviado vía …"). Misma resolución que \Innertia\Mail\Branding::for().
 *
 *   <Mail.BrandingPreview :branding="form" :platform="data.platform" />   // marca del espacio
 *   <Mail.BrandingPreview :platform="{ name, logo_url, color }" />        // marca de plataforma
 *
 * Un logo que no carga se reemplaza por el nombre (como en el correo real).
 */
const props = withDefaults(defineProps<{
  branding?: BrandingFields | null
  platform?: Partial<ResolvedBranding> | null
  title?: string
  body?: string
  action?: string
}>(), {
  branding: null,
  platform: null,
  title: 'Nuevo mensaje de voz',
  body: 'Tienes un mensaje nuevo en tu buzón. Escúchalo desde la plataforma.',
  action: 'Ver detalle',
})

const resolved = computed(() => resolveBrandingPreview(props.branding, props.platform))
const logoFailed = ref(false)
watch(() => resolved.value.logo_url, () => { logoFailed.value = false })
const footer = computed(() => [resolved.value.footer_address, resolved.value.footer_phone].filter(Boolean).join(' · '))
const year = new Date().getFullYear()
</script>

<template>
  <div class="rounded-card border border-card-line bg-[#f4f4f5] p-5 text-left" data-testid="branding-preview">
    <div class="flex justify-center pb-4">
      <img
        v-if="resolved.logo_url && !logoFailed"
        :src="resolved.logo_url"
        :alt="resolved.name"
        class="h-10 w-auto max-w-full object-contain"
        @error="logoFailed = true"
      />
      <span v-else class="text-xl font-bold" :style="{ color: resolved.color }">{{ resolved.name }}</span>
    </div>
    <div class="rounded-lg bg-white px-6 py-6 shadow-sm">
      <p class="text-lg font-bold text-zinc-900">{{ title }}</p>
      <p class="mt-2 text-sm text-zinc-500">{{ body }}</p>
      <div class="mt-5 flex justify-center">
        <span class="inline-block rounded-md px-5 py-2.5 text-sm font-semibold text-white" :style="{ backgroundColor: resolved.color }">{{ action }}</span>
      </div>
    </div>
    <p class="pt-4 text-center text-[11px] leading-relaxed text-zinc-400">
      <template v-if="footer">{{ footer }}<br></template>
      &copy; {{ year }} {{ resolved.name }}. Todos los derechos reservados.
      <template v-if="resolved.via"><br>Enviado vía {{ resolved.via }}</template>
    </p>
  </div>
</template>
