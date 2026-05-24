<script setup lang="ts">
/**
 * Formulario de login estándar reutilizable.
 *
 * - Email + password + botón ingresar
 * - Botones OAuth dinámicos según tenant (saas) o appConfig (app)
 * - Banner de modo demo si tenant.config.demo está presente
 * - Cross-links a otros contextos mobile-friendly (configurable via prop)
 *
 * Uso:
 *   <AuthLoginForm context="backoffice" />
 */
import { IconBrandGoogle, IconBrandWindows, IconBrandApple, IconBrandGithub, IconArrowRight, IconEye, IconEyeOff } from '@tabler/icons-vue'
import type { OAuthProvider } from '../../app.config'

const props = defineProps<{
  /** Contexto del backend al que el form hace login (ej. 'backoffice', 'technician'). */
  context: string
  /** Título del form. */
  title?: string
  /** Subtítulo / descripción. */
  description?: string
  /** Mostrar cross-links a otros apps mobile-friendly. */
  showCrossLinks?: boolean
}>()

const heading = computed(() => props.title ?? 'Bienvenido de nuevo')
const subheading = computed(() => props.description ?? 'Ingresa tus credenciales para acceder a tu espacio de trabajo.')

const { performLogin, getOauthRedirectUrl } = useAuth()
const config = useRuntimeConfig()

// ── Demo credentials & OAuth providers (vienen del tenant config en saas, del appConfig en app) ──
const { hasTenant, isApp } = useInnertiaMode()
const appConfig = useAppConfig()
const tenantStore = hasTenant() ? useTenantStore() : null

const demo = computed<{ email?: string; password?: string } | null>(() => {
  if (tenantStore) return (tenantStore as any).config?.demo ?? null
  return null
})

const oauthProviders = computed<OAuthProvider[]>(() => {
  if (tenantStore) {
    const fromTenant = (tenantStore as any).config?.oauth as OAuthProvider[] | undefined
    return Array.isArray(fromTenant) ? fromTenant : []
  }
  return (appConfig.innertia?.oauth ?? []) as OAuthProvider[]
})

const oauthIcon = (provider: OAuthProvider) => ({
  google:    IconBrandGoogle,
  microsoft: IconBrandWindows,
  apple:     IconBrandApple,
  github:    IconBrandGithub,
}[provider])

const oauthLabel = (provider: OAuthProvider) => ({
  google:    'Google',
  microsoft: 'Microsoft',
  apple:     'Apple',
  github:    'GitHub',
}[provider])

// ── Form state ─────────────────────────────────────────────────────────────
const form = useForm({
  email:    { value: demo.value?.email    ?? '', rules: ['required', 'email'] },
  password: { value: demo.value?.password ?? '', rules: ['required', { name: 'min', arg: 8 }] },
})

const processing = ref(false)
const showPassword = ref(false)

async function handleSubmit() {
  if (!form.validate()) return
  processing.value = true
  try {
    const data = await performLogin(props.context, form.values.email, form.values.password)
    if (data?.requires_password_change) {
      await navigateTo(`/${props.context}/auth/change-password`)
    } else {
      await navigateTo(config.public.homePath || `/${props.context}`)
    }
  } catch (e: any) {
    form.addError('password', e?.data?.message ?? 'Credenciales incorrectas.')
  } finally {
    processing.value = false
  }
}

async function handleOauth(provider: OAuthProvider) {
  try {
    const url = await getOauthRedirectUrl(props.context, provider)
    if (url) window.location.href = url
  } catch (e: any) {
    form.addError('email', e?.data?.message ?? `Error al iniciar sesión con ${oauthLabel(provider)}.`)
  }
}

// ── Cross-links a otros contextos mobile-friendly (opcional) ───────────────
const { isMobile } = useMobileGuard()
const { all } = useApp()
const otherMobileApps = computed(() => {
  if (!props.showCrossLinks) return []
  return all.value.filter((a: any) => a.path !== `/${props.context}` && a.mobile?.mode === 'allow')
})
</script>

<template>
  <div class="space-y-6">
    <!-- Heading -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ heading }}</h1>
      <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{{ subheading }}</p>
    </div>

    <!-- OAuth providers (dinámicos según tenant/app config) -->
    <div v-if="oauthProviders.length > 0" class="space-y-3">
      <div :class="oauthProviders.length === 1 ? '' : 'grid grid-cols-2 gap-3'">
        <button
          v-for="provider in oauthProviders"
          :key="provider"
          type="button"
          @click="handleOauth(provider)"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
        >
          <component :is="oauthIcon(provider)" class="size-4 shrink-0" />
          {{ oauthLabel(provider) }}
        </button>
      </div>
      <div class="relative">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-200 dark:border-slate-700" /></div>
        <div class="relative flex justify-center"><span class="bg-white dark:bg-slate-900 px-3 text-xs text-slate-400">O continúa con tu correo</span></div>
      </div>
    </div>

    <!-- Demo banner -->
    <div v-if="demo" class="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3.5 py-3">
      <svg class="shrink-0 mt-0.5 size-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
      </svg>
      <div>
        <p class="text-xs font-semibold text-amber-700 dark:text-amber-400">Modo demo</p>
        <p class="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Credenciales precargadas. Haz clic en <strong>Ingresar</strong> para explorar.</p>
      </div>
    </div>

    <!-- Form -->
    <form class="space-y-4" @submit.prevent="handleSubmit" novalidate>
      <div>
        <label class="block mb-2 text-sm font-medium text-slate-800 dark:text-white">Correo electrónico</label>
        <input
          v-model="form.values.email"
          type="email"
          :disabled="processing"
          autocomplete="email"
          placeholder="tu@correo.com"
          @blur="form.validate('email')"
          class="py-2.5 px-3 block w-full border rounded-lg sm:text-sm placeholder:text-slate-400 focus:ring-1 disabled:opacity-50 dark:bg-transparent dark:text-slate-300"
          :class="form.errors.email?.length ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-slate-200 focus:border-primary focus:ring-primary dark:border-slate-700'"
        />
        <p v-if="form.errors.email?.length" class="mt-1.5 text-xs text-red-500">{{ form.errors.email[0] }}</p>
      </div>

      <div>
        <div class="flex justify-between items-center mb-2">
          <label class="text-sm font-medium text-slate-800 dark:text-white">Contraseña</label>
          <NuxtLink :to="`/${context}/auth/forgot-password`" class="text-xs text-primary hover:underline">
            ¿Olvidaste tu contraseña?
          </NuxtLink>
        </div>
        <div class="relative">
          <input
            v-model="form.values.password"
            :type="showPassword ? 'text' : 'password'"
            :disabled="processing"
            autocomplete="current-password"
            placeholder="••••••••"
            @blur="form.validate('password')"
            class="py-2.5 px-3 block w-full border rounded-lg sm:text-sm placeholder:text-slate-400 focus:ring-1 disabled:opacity-50 dark:bg-transparent dark:text-slate-300"
            :class="form.errors.password?.length ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-slate-200 focus:border-primary focus:ring-primary dark:border-slate-700'"
          />
          <button
            type="button"
            tabindex="-1"
            @click="showPassword = !showPassword"
            class="absolute inset-y-0 end-0 flex items-center px-3 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <IconEyeOff v-if="showPassword" class="size-4" />
            <IconEye v-else class="size-4" />
          </button>
        </div>
        <p v-if="form.errors.password?.length" class="mt-1.5 text-xs text-red-500">{{ form.errors.password[0] }}</p>
      </div>

      <button
        type="submit"
        :disabled="processing"
        class="py-2.5 px-3 w-full inline-flex justify-center items-center gap-x-2 text-sm font-semibold rounded-lg border border-transparent bg-primary hover:bg-primary-hover text-white disabled:opacity-50"
      >
        <span v-if="processing" class="animate-spin inline-block size-4 border-[2px] border-t-transparent border-white rounded-full" />
        <span v-else class="flex items-center gap-x-2">
          Ingresar
          <IconArrowRight class="size-4" />
        </span>
      </button>
    </form>

    <!-- Cross-links a otros contextos mobile-friendly -->
    <div v-if="isMobile && otherMobileApps.length > 0" class="space-y-2 pt-2">
      <div class="relative py-1">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-200 dark:border-slate-700" /></div>
        <div class="relative flex justify-center"><span class="bg-white dark:bg-slate-900 px-3 text-[11px] uppercase tracking-wider text-slate-400">o</span></div>
      </div>
      <NuxtLink
        v-for="other in otherMobileApps"
        :key="other.path"
        :to="other.loginPath"
        class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
      >
        Entrar como {{ other.label }}
      </NuxtLink>
    </div>
  </div>
</template>
