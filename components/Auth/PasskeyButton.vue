<script setup>
import { IconFingerprint } from '@tabler/icons-vue'

// Botón "Ingresar con huella o passkey" para cualquier login.
//  - contexts: lista ordenada (login tenant). platform: login de /platform.
//  - autofill: además arranca el autocompletado (el campo de correo del form
//    debe tener autocomplete="username webauthn").
// Emite success(data) con el body del BFF (data.context; data.tenantDestination
// en modo open) o pending(data) si hay un paso previo (cambio forzado de clave).
const props = defineProps({
  contexts: { type: Array, default: () => [] },
  platform: { type: Boolean, default: false },
  autofill: { type: Boolean, default: true },
  label: { type: String, default: 'Ingresar con huella o passkey' },
})
const emit = defineEmits(['success', 'pending', 'error'])

const passkeys = usePasskeys()
const loading = ref(false)
const error = ref('')

function handle(data) {
  if (!data) return
  if (data.user) emit('success', data)
  else emit('pending', data)
}

async function click() {
  error.value = ''
  loading.value = true
  passkeys.stopAutofill()
  try {
    handle(props.platform ? await passkeys.loginPlatform() : await passkeys.login({ contexts: props.contexts }))
  } catch (e) {
    if (!passkeys.isCancel(e)) {
      error.value = passkeys.errorMessage(e)
      emit('error', error.value)
    }
  } finally {
    loading.value = false
    startAutofill()
  }
}

async function startAutofill() {
  if (!props.autofill) return
  try {
    handle(await passkeys.startAutofill({ contexts: props.contexts, platform: props.platform }))
  } catch (e) {
    if (!passkeys.isCancel(e)) {
      error.value = passkeys.errorMessage(e)
      emit('error', error.value)
    }
  }
}

onMounted(startAutofill)
onBeforeUnmount(() => passkeys.stopAutofill())
</script>

<template>
  <div v-if="passkeys.supported.value" class="space-y-2">
    <button
      type="button"
      :disabled="loading"
      class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-card-line bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted-hover focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      @click="click"
    >
      <span v-if="loading" class="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      <IconFingerprint v-else class="size-4" />
      {{ label }}
    </button>
    <p v-if="error" class="text-xs text-red-500" role="alert">{{ error }}</p>
  </div>
</template>
