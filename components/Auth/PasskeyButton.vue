<script setup>
import { IconFingerprint } from '@tabler/icons-vue'

// Botón "Ingresar con huella o passkey" para cualquier login.
//  - contexts: lista ordenada (login tenant). OBLIGATORIA salvo con `platform`:
//    sin contexts el composable lanza 'PasskeyButton requiere contexts' antes de
//    cualquier ceremonia (el backend exige al menos uno).
//  - platform: login de /platform.
//  - autofill: además arranca el autocompletado (el campo de correo del form
//    debe tener autocomplete="username webauthn"; sin ese input no arranca).
// Emite success(data) con el body del BFF (data.context; data.tenantDestination
// en modo open), pending(data) si hay un paso previo (cambio forzado de clave) o
// error(message, originalError). Las cancelaciones no emiten nada.
const props = defineProps({
  contexts: {
    type: Array,
    default: () => [],
    // Nota: la validación real (contexts requeridos sin `platform`) ocurre al
    // iniciar la ceremonia, porque depende de otra prop.
    validator: v => Array.isArray(v) && v.every(c => typeof c === 'string'),
  },
  platform: { type: Boolean, default: false },
  autofill: { type: Boolean, default: true },
  label: { type: String, default: 'Ingresar con huella o passkey' },
})
const emit = defineEmits(['success', 'pending', 'error'])

const passkeys = usePasskeys()
const loading = ref(false)
const error = ref('')
let mounted = false

function handle(data) {
  if (!data) return false
  if (data.user) {
    emit('success', data)
    return true
  }
  emit('pending', data)
  return true
}

function fail(e) {
  error.value = passkeys.errorMessage(e)
  emit('error', error.value, e)
}

async function click() {
  error.value = ''
  loading.value = true
  let done = false
  try {
    // login() invalida el autocompletado antes de su propia ceremonia.
    done = handle(props.platform ? await passkeys.loginPlatform() : await passkeys.login({ contexts: props.contexts }))
  } catch (e) {
    if (!passkeys.isDismissed(e)) fail(e)
  } finally {
    loading.value = false
  }
  // Tras un ingreso exitoso no se reanuda; solo tras fallo/cancelación y si sigue montado.
  if (!done && mounted) startAutofill()
}

async function startAutofill() {
  if (!props.autofill || !mounted) return
  try {
    const done = handle(await passkeys.startAutofill({ contexts: props.contexts, platform: props.platform }))
    if (done) return
  } catch (e) {
    // Solo llegan aquí errores tras elegir una passkey (BFF) o de configuración (ya avisado por consola).
    if (passkeys.isContextsError(e)) return
    if (!passkeys.isDismissed(e)) fail(e)
    // Falló la verificación: se vuelve a ofrecer el autocompletado.
    if (mounted && !loading.value) startAutofill()
  }
}

onMounted(() => {
  mounted = true
  startAutofill()
})
onBeforeUnmount(() => {
  mounted = false
  passkeys.dispose()
})
</script>

<template>
  <div v-if="passkeys.supported.value" class="space-y-2">
    <button
      type="button"
      :disabled="loading"
      :aria-busy="loading ? 'true' : 'false'"
      class="inline-flex w-full items-center justify-center gap-2 rounded-control border border-card-line bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      @click="click"
    >
      <span v-if="loading" class="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />
      <IconFingerprint v-else class="size-4" aria-hidden="true" />
      {{ label }}
    </button>
    <p v-if="error" class="text-xs text-red-500" role="alert">{{ error }}</p>
  </div>
</template>
