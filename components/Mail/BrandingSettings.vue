<script setup lang="ts">
import { IconSend, IconPalette } from '@tabler/icons-vue'
import { DEFAULT_BRAND_COLOR, validateBranding } from '../../composables/internal/mailBranding'

/*
 * Mail.BrandingSettings — marca del espacio para los correos de negocio ("Sistema › Marca").
 * Backend: \Innertia\Mail\Routes::tenantBranding('settings/branding') → GET|PUT, POST /test.
 *
 *   <Mail.BrandingSettings />
 *   <Mail.BrandingSettings>
 *     <template #logo-picker="{ set }"><MiSelectorDeArchivos @picked="(f) => set({ logo_file_id: f.id })" /></template>
 *   </Mail.BrandingSettings>
 *
 * Vista previa en vivo, aviso de cambios sin guardar y "Enviarme un correo de prueba" (usa lo guardado).
 */
const props = withDefaults(defineProps<{ endpoint?: string }>(), { endpoint: 'settings/branding' })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const base = props.endpoint.replace(/^\/+|\/+$/g, '')

const { data, isPending } = useQuery({ queryKey: ['mail', 'branding', base], queryFn: () => api.get(base) })

const FIELDS = ['display_name', 'logo_url', 'logo_file_id', 'color', 'footer_address', 'footer_phone'] as const
type Field = typeof FIELDS[number]
const form = reactive<Record<Field, string>>(Object.fromEntries(FIELDS.map(f => [f, ''])) as any)
const errors = reactive<Record<string, string | null>>({})
FIELDS.forEach(f => watch(() => form[f], () => { errors[f] = null }))

const saved = ref('')
const snapshot = () => JSON.stringify(form)
const isDirty = computed(() => snapshot() !== saved.value)
const platform = computed(() => (data.value as any)?.platform ?? null)
const previewFields = computed(() => ({
  ...form,
  // Un logo desde Archivos se ve con la URL resuelta por el servidor (una vez guardado).
  logo_url: form.logo_url || (form.logo_file_id && !isDirty.value ? (data.value as any)?.resolved?.logo_url : '') || '',
}))

watch(data, (v: any) => {
  if (!v) return
  FIELDS.forEach((f) => { form[f] = v.branding?.[f] ?? '' })
  saved.value = snapshot()
}, { immediate: true })

function set(values: Partial<Record<Field, string | null>>) {
  for (const [k, v] of Object.entries(values)) {
    if ((FIELDS as readonly string[]).includes(k)) form[k as Field] = v ?? ''
  }
  if (values.logo_file_id) form.logo_url = ''
  if (values.logo_url) form.logo_file_id = ''
}

const saving = ref(false)
async function save() {
  Object.assign(errors, validateBranding(form))
  if (Object.values(errors).some(Boolean)) return
  saving.value = true
  try {
    const payload = Object.fromEntries(FIELDS.map(f => [f, form[f].trim() || null]))
    const res = await api.put(base, payload)
    queryClient.setQueryData(['mail', 'branding', base], { ...(data.value as any), ...res })
    saved.value = snapshot()
    toast.success('Marca guardada.')
  } catch (e: any) {
    const fieldErrors = e?.data?.errors ?? {}
    FIELDS.forEach((f) => { errors[f] = fieldErrors[f]?.[0] ?? null })
    if (!FIELDS.some(f => errors[f])) toast.error(e?.data?.message ?? 'No se pudo guardar.')
  } finally {
    saving.value = false
  }
}

function discard() {
  const v: any = data.value
  FIELDS.forEach((f) => { form[f] = v?.branding?.[f] ?? '' })
}

const testing = ref(false)
async function sendTest() {
  if (isDirty.value) { toast.error('Guarda los cambios antes de probar: la prueba usa la marca guardada.'); return }
  testing.value = true
  try {
    const res: any = await api.post(`${base}/test`, {})
    toast.success(`Correo de prueba enviado a ${res?.sent_to ?? 'tu correo'}.`)
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'No se pudo enviar la prueba.')
  } finally {
    testing.value = false
  }
}

onBeforeRouteLeave(() => {
  if (isDirty.value && import.meta.client) return window.confirm('Tienes cambios sin guardar. ¿Salir igual?')
})
</script>

<template>
  <div class="space-y-5">
    <div v-if="isPending" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
    <div v-else class="grid lg:grid-cols-2 gap-5 items-start">
      <div class="space-y-4">
        <div class="bg-card border border-card-line rounded-card p-5 space-y-4">
          <Forms.Input v-model="form.display_name" label="Nombre visible" :placeholder="platform?.name ?? ''" :error="errors.display_name" hint="Aparece en el encabezado de los correos si no hay logo." />
          <div class="space-y-2">
            <Forms.Input v-model="form.logo_url" label="URL del logo" placeholder="https://…/logo.png" :error="errors.logo_url" hint="Imagen pública (PNG o SVG). Si no carga, el correo muestra el nombre." />
            <slot name="logo-picker" :set="set" />
            <p v-if="form.logo_file_id" class="text-xs text-muted-foreground">
              Logo desde Documentos seleccionado.
              <button type="button" class="text-red-500 hover:underline" @click="form.logo_file_id = ''">Quitar</button>
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Color</label>
            <div class="flex items-start gap-3">
              <input v-model="form.color" type="color" class="h-9 w-14 rounded-control border border-card-line bg-transparent p-1 cursor-pointer" />
              <Forms.Input v-model="form.color" class="w-40" :placeholder="platform?.color ?? DEFAULT_BRAND_COLOR" :error="errors.color" />
            </div>
          </div>
          <div class="grid sm:grid-cols-2 gap-4">
            <Forms.Input v-model="form.footer_address" label="Dirección (pie)" placeholder="Av. Principal 123, Ciudad" :error="errors.footer_address" />
            <Forms.Input v-model="form.footer_phone" label="Teléfono (pie)" placeholder="+56 72 000 0000" :error="errors.footer_phone" />
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2">
          <span v-if="isDirty" class="text-xs text-amber-600 dark:text-amber-400 mr-auto">Tienes cambios sin guardar.</span>
          <App.Button v-if="isDirty" text="Descartar" severity="secondary" size="sm" @click="discard" />
          <App.Button text="Enviarme un correo de prueba" :icon="IconSend" severity="secondary" size="sm" :disabled="isDirty" :loading="testing" @click="sendTest" />
          <App.Button text="Guardar" severity="primary" size="sm" :disabled="!isDirty" :loading="saving" @click="save" />
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium text-foreground flex items-center gap-1.5"><IconPalette class="size-4" :stroke-width="1.5" /> Vista previa</p>
        <Mail.BrandingPreview :branding="previewFields" :platform="platform" />
      </div>
    </div>
  </div>
</template>
