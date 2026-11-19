<script setup lang="ts">
import { IconMail, IconSend } from '@tabler/icons-vue'
import { HEX_COLOR } from '../../composables/internal/mailBranding'

/*
 * Platform.MailSettings — configuración de correo de la plataforma (solo owner).
 * Backend: \Innertia\Mail\Routes::platform('') → GET|PUT mail-settings, DELETE mail-settings/resend-key,
 * POST mail-settings/test. Página sugerida:
 *
 *   definePageMeta({ layout: 'platform', middleware: ['platform-owner'] })
 *   <Platform.MailSettings>
 *     <template #logo-picker="{ set }"><MiSelector @picked="set" /></template>   // opcional
 *   </Platform.MailSettings>
 *
 * Validación por campo (local + 422), aviso de cambios sin guardar, confirmación al borrar la
 * key de Resend, correo de prueba con la configuración guardada y vista previa (en vivo y del
 * correo realmente enviado).
 */
const props = withDefaults(defineProps<{ endpoint?: string }>(), { endpoint: 'platform/mail-settings' })

const api = useApi()
const toast = useToast()
const { confirm } = useModal()
const queryClient = useQueryClient()
const base = props.endpoint.replace(/^\/+|\/+$/g, '')
const queryKey = ['platform', 'mail-settings', base]

const { data, isPending } = useQuery({ queryKey, queryFn: () => api.get(base) })

const form = reactive({ mailer: 'smtp', from_name: '', from_address: '', logo_url: '', brand_color: '#6366f1' })
const resendKeyInput = ref('')
const resendKeySet = ref(false)

const BASE_MAILERS = [
  { value: 'smtp', label: 'Mailpit / SMTP (desarrollo)' },
  { value: 'resend', label: 'Resend (producción)' },
]
const MAILERS = computed(() => ((data.value as any)?.mailer === 'log' || form.mailer === 'log')
  ? [...BASE_MAILERS, { value: 'log', label: 'Registro (solo pruebas)' }]
  : BASE_MAILERS)

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HTTP_URL = /^https?:\/\//i
const FIELDS = ['from_name', 'from_address', 'logo_url', 'brand_color'] as const
const errors = reactive<Record<string, string | null>>(Object.fromEntries(FIELDS.map(f => [f, null])))
FIELDS.forEach(f => watch(() => form[f], () => { errors[f] = null }))

const savedSnapshot = ref('')
const snapshot = () => JSON.stringify({ ...form })
const isDirty = computed(() => snapshot() !== savedSnapshot.value || !!resendKeyInput.value.trim())

watch(data, (v: any) => {
  if (!v) return
  form.mailer = v.mailer ?? 'smtp'
  form.from_name = v.from_name ?? ''
  form.from_address = v.from_address ?? ''
  form.logo_url = v.logo_url ?? ''
  form.brand_color = v.brand_color ?? '#6366f1'
  resendKeySet.value = !!v.resend_api_key_set
  resendKeyInput.value = ''
  savedSnapshot.value = snapshot()
}, { immediate: true })

const preview = computed(() => ({ name: form.from_name || 'Plataforma', logo_url: form.logo_url, color: form.brand_color }))

const saving = ref(false)
async function save() {
  FIELDS.forEach((f) => { errors[f] = null })
  if (form.from_address && !EMAIL.test(form.from_address.trim())) errors.from_address = 'Ingresa un correo válido, por ejemplo no-reply@tudominio.cl.'
  if (form.logo_url && !HTTP_URL.test(form.logo_url.trim())) errors.logo_url = 'La URL del logo debe comenzar con http:// o https://.'
  if (form.brand_color && !HEX_COLOR.test(form.brand_color.trim())) errors.brand_color = 'El color de marca debe ser un hexadecimal como #6366f1 o #fff.'
  if (FIELDS.some(f => errors[f])) return
  saving.value = true
  try {
    const payload: Record<string, any> = { ...form }
    if (resendKeyInput.value.trim()) payload.resend_api_key = resendKeyInput.value.trim()
    const res = await api.put(base, payload)
    queryClient.setQueryData(queryKey, res)
    savedSnapshot.value = snapshot()
    resendKeyInput.value = ''
    toast.success('Configuración de correo guardada.')
  } catch (e: any) {
    const fieldErrors = e?.data?.errors ?? {}
    FIELDS.forEach((f) => { errors[f] = fieldErrors[f]?.[0] ?? null })
    if (!FIELDS.some(f => errors[f])) toast.error(e?.data?.message ?? 'No se pudo guardar.')
  } finally {
    saving.value = false
  }
}

async function clearResendKey() {
  if (!await confirm({ severity: 'danger', title: 'Eliminar API key de Resend', message: 'Se borrará la API key guardada. Si Resend es el proveedor activo, los correos dejarán de enviarse hasta que configures una nueva.', confirmText: 'Eliminar' })) return
  try {
    const res = await api.delete(`${base}/resend-key`)
    queryClient.setQueryData(queryKey, res)
    toast.success('API key de Resend eliminada.')
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'No se pudo eliminar.')
  }
}

const testEmail = ref('')
const testEmailError = ref<string | null>(null)
const sentHtml = ref<string | null>(null)
watch(testEmail, () => { testEmailError.value = null })
const testing = ref(false)
async function sendTest() {
  if (testing.value) return
  if (isDirty.value) { toast.error('Guarda los cambios antes de probar: la prueba usa la configuración guardada.'); return }
  if (!testEmail.value) { testEmailError.value = 'Ingresa un correo de destino.'; return }
  if (!EMAIL.test(testEmail.value.trim())) { testEmailError.value = 'Ingresa un correo válido.'; return }
  testing.value = true
  try {
    const res: any = await api.post(`${base}/test`, { email: testEmail.value.trim() })
    sentHtml.value = res?.html ?? null
    toast.success(`Correo de prueba enviado a ${testEmail.value}.`)
  } catch (e: any) {
    testEmailError.value = e?.data?.errors?.email?.[0] ?? null
    if (!testEmailError.value) toast.error(e?.data?.message ?? 'No se pudo enviar la prueba.')
  } finally {
    testing.value = false
  }
}

onBeforeRouteLeave(() => {
  if (isDirty.value && import.meta.client) return window.confirm('Tienes cambios sin guardar. ¿Salir igual?')
})
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-5">
    <div class="flex items-center gap-3">
      <div class="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <IconMail class="size-5" :stroke-width="1.5" />
      </div>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg font-semibold text-foreground">Configuración de correo</h1>
        <p class="text-sm text-muted-foreground">Proveedor, remitente y marca de los correos que envía la plataforma.</p>
      </div>
      <span v-if="isDirty" class="text-xs text-amber-600 dark:text-amber-400">Cambios sin guardar</span>
      <App.Button v-if="!isPending" text="Guardar" severity="primary" size="sm" :disabled="!isDirty" :loading="saving" @click="save" />
    </div>

    <div v-if="isPending" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>

    <div v-else class="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
      <div class="space-y-5">
        <div class="bg-card border border-card-line rounded-card p-5 space-y-4">
          <p class="text-sm font-semibold text-foreground">Proveedor de envío</p>
          <Forms.Select v-model="form.mailer" label="Proveedor" :clearable="false" :options="MAILERS" />

          <div v-if="form.mailer === 'resend'" class="space-y-1.5">
            <label class="block text-sm font-medium text-foreground">API key de Resend</label>
            <div class="flex items-center gap-3">
              <input
                v-model="resendKeyInput"
                type="password"
                autocomplete="off"
                :placeholder="resendKeySet ? '•••••••••• (guardada)' : 're_xxxxxxxxxxxx'"
                class="flex-1 h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
              <button v-if="resendKeySet" type="button" class="text-xs text-red-500 hover:underline shrink-0" @click="clearResendKey">Eliminar</button>
            </div>
            <p class="text-xs text-muted-foreground">
              Se guarda encriptada. Déjala en blanco para conservar la actual.
              <span v-if="resendKeySet" class="text-emerald-600 dark:text-emerald-400">Hay una key configurada.</span>
              <span v-else class="text-amber-600 dark:text-amber-400">Aún no hay key configurada.</span>
            </p>
            <p class="text-xs text-muted-foreground">El dominio del remitente debe estar verificado en Resend.</p>
          </div>
        </div>

        <div class="bg-card border border-card-line rounded-card p-5 space-y-4">
          <p class="text-sm font-semibold text-foreground">Remitente y marca</p>
          <div class="grid sm:grid-cols-2 gap-4">
            <Forms.Input v-model="form.from_name" maxlength="120" label="Nombre del remitente" placeholder="Mi plataforma" :error="errors.from_name" />
            <Forms.Input v-model="form.from_address" label="Correo del remitente" type="email" placeholder="no-reply@tudominio.cl" :error="errors.from_address" />
          </div>
          <div class="space-y-2">
            <Forms.Input v-model="form.logo_url" label="URL del logo (correos)" placeholder="https://…/logo.png" :error="errors.logo_url" />
            <slot name="logo-picker" :set="(url: string) => (form.logo_url = url)" />
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Color de marca</label>
            <div class="flex items-start gap-3">
              <input v-model="form.brand_color" type="color" class="h-9 w-14 rounded-control border border-card-line bg-transparent p-1 cursor-pointer" />
              <Forms.Input v-model="form.brand_color" class="w-40" placeholder="#6366f1" :error="errors.brand_color" />
            </div>
          </div>
        </div>

        <div class="bg-card border border-card-line rounded-card p-5 space-y-3">
          <div class="flex items-center gap-2">
            <IconSend class="size-4 text-muted-foreground" />
            <p class="text-sm font-medium text-foreground">Enviar correo de prueba</p>
          </div>
          <p class="text-xs text-muted-foreground">Envía un correo de ejemplo con la configuración guardada.</p>
          <div class="flex items-end gap-2">
            <Forms.Input v-model="testEmail" label="Correo de destino" type="email" placeholder="tu@correo.com" :error="testEmailError" class="flex-1 min-w-0" @keydown.enter.prevent="sendTest" />
            <App.Button text="Enviar prueba" :icon="IconSend" severity="secondary" size="sm" :loading="testing" :disabled="isDirty" @click="sendTest" />
          </div>
          <p v-if="isDirty" class="text-xs text-amber-600 dark:text-amber-400">Guarda los cambios antes de probar: la prueba usa la configuración guardada.</p>
          <iframe v-if="sentHtml" :srcdoc="sentHtml" title="Correo de prueba enviado" sandbox="" class="w-full h-96 rounded-card border border-card-line bg-white" />
        </div>
      </div>

      <div class="space-y-2 lg:sticky lg:top-4">
        <p class="text-sm font-medium text-foreground">Vista previa</p>
        <Mail.BrandingPreview :platform="preview" title="¡La configuración de correo funciona!" body="Así se verán los correos de cuenta (invitación, recuperación, códigos)." action="Botón de ejemplo" />
      </div>
    </div>
  </div>
</template>
