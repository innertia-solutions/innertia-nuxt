<script setup>
// Consola /platform: interruptor del ingreso con passkey (guardado en BD).
// El producto registra las rutas con \Innertia\Passkeys\Routes::platformSettings('')
// en su grupo platform. GET/PUT platform/passkeys/settings.
const api = useApi()
const toast = useToast()
const passkeys = usePasskeys({ platform: true })

const settings = ref(null)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)

function errorText(e) {
  return e?.data?.message || e?.message || 'No se pudo completar la operación.'
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await api.get('platform/passkeys/settings')
    if (!res) throw new Error('Tu sesión expiró.')
    settings.value = res
  } catch (e) {
    loadError.value = errorText(e)
  } finally {
    loading.value = false
  }
}

// Optimista: se refleja al instante y se revierte si el servidor falla.
async function toggle(key) {
  if (!settings.value || saving.value) return
  const previous = { ...settings.value }
  const next = !settings.value[key]
  settings.value = { ...settings.value, [key]: next }
  saving.value = true
  try {
    const body = { enabled: key === 'enabled' ? next : previous.enabled }
    if (key === 'allow_subdomains') body.allow_subdomains = next
    const res = await api.put('platform/passkeys/settings', body)
    if (!res) throw new Error('Tu sesión expiró.')
    settings.value = res
    await passkeys.refreshStatus()
    toast.success('Configuración de passkeys guardada.')
  } catch (e) {
    settings.value = previous
    toast.error(errorText(e))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="rounded-card border border-card-line bg-card">
    <div class="border-b border-card-line px-5 py-4">
      <h3 class="text-sm font-semibold text-foreground">Passkeys</h3>
      <p class="mt-0.5 text-xs text-muted-foreground">Configuración del ingreso con passkey para todos los usuarios.</p>
    </div>

    <div v-if="loading" class="px-5 py-6 text-sm text-muted-foreground">Cargando…</div>

    <div v-else-if="loadError" class="flex items-center justify-between gap-3 px-5 py-6" role="alert">
      <p class="text-sm text-red-600">{{ loadError }}</p>
      <App.Button text="Reintentar" size="sm" @click="load" />
    </div>

    <div v-else-if="settings" class="divide-y divide-card-line">
      <div class="flex items-start justify-between gap-6 px-5 py-4">
        <div class="space-y-1">
          <p class="text-sm font-medium text-foreground">Ingreso con passkey</p>
          <p class="text-sm text-muted-foreground">
            Permite ingresar con huella, rostro o PIN del dispositivo. La contraseña sigue funcionando.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="!!settings.enabled"
          :disabled="saving"
          class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          :class="settings.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'"
          @click="toggle('enabled')"
        >
          <span class="sr-only">Ingreso con passkey</span>
          <span
            class="inline-block size-5 rounded-full bg-white shadow transition-transform"
            :class="settings.enabled ? 'translate-x-5' : 'translate-x-0.5'"
          />
        </button>
      </div>

      <div class="flex items-start justify-between gap-6 px-5 py-4">
        <div class="space-y-1">
          <p class="text-sm font-medium text-foreground">Permitir subdominios</p>
          <p class="text-sm text-muted-foreground">
            Las passkeys valen también en los subdominios de los tenants (por ejemplo, acme.{{ settings.rp_id }}).
            Actívalo solo si los tenants viven en subdominios.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="!!settings.allow_subdomains"
          :disabled="saving"
          class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          :class="settings.allow_subdomains ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'"
          @click="toggle('allow_subdomains')"
        >
          <span class="sr-only">Permitir subdominios</span>
          <span
            class="inline-block size-5 rounded-full bg-white shadow transition-transform"
            :class="settings.allow_subdomains ? 'translate-x-5' : 'translate-x-0.5'"
          />
        </button>
      </div>

      <div class="space-y-1 px-5 py-4 text-xs text-muted-foreground">
        <p>Dominio: <span class="font-medium text-foreground">{{ settings.rp_id }}</span></p>
        <p v-if="settings.origins?.length">
          Orígenes: <span class="text-foreground">{{ settings.origins.join(', ') }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
