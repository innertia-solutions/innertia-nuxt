<script setup>
import { IconFingerprint, IconX } from '@tabler/icons-vue'
import { shouldShowPasskeyInvite, inviteStorageKey } from '../../composables/usePasskeys/internal/passkeys'

// Aviso discreto tras ingresar con contraseña: "Ingresa con tu huella la próxima
// vez". Una vez por usuario y dispositivo (localStorage). base: 'auth' | 'platform/auth'.
const props = defineProps({
  base: { type: String, default: 'auth' },
})

const passkeys = usePasskeys()
const authStore = useAuthStore()
const toast = useToast()
const visible = ref(false)
const saving = ref(false)

const userId = computed(() => authStore.user?.id)

function dismissed() {
  try { return localStorage.getItem(inviteStorageKey(userId.value)) === 'dismissed' } catch { return true }
}

function dismiss() {
  try { localStorage.setItem(inviteStorageKey(userId.value), 'dismissed') } catch {}
  visible.value = false
}

onMounted(async () => {
  if (!userId.value || !passkeys.supported.value) return
  let hasPasskeys = true
  try { hasPasskeys = (await passkeys.list(props.base)).length > 0 } catch { return }
  visible.value = shouldShowPasskeyInvite({
    supported: passkeys.supported.value,
    enabled: true,
    dismissed: dismissed(),
    hasPasskeys,
    loggedInWithPasskey: passkeys.loggedInWithPasskey(),
  })
})

async function activate() {
  saving.value = true
  try {
    await passkeys.register(undefined, props.base)
    toast.success('Listo: la próxima vez ingresa con tu huella.')
    dismiss()
  } catch (e) {
    if (!passkeys.isCancel(e)) toast.error(passkeys.errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="flex items-center gap-3 rounded-card border border-card-line bg-card px-4 py-3 shadow-sm"
    role="status"
  >
    <IconFingerprint class="size-5 shrink-0 text-primary" />
    <p class="flex-1 text-sm text-foreground">
      Ingresa con tu huella la próxima vez, sin contraseña.
    </p>
    <App.Button text="Activar" severity="primary" size="sm" :loading="saving" @click="activate" />
    <button type="button" class="text-muted-foreground hover:text-foreground" aria-label="Ahora no" @click="dismiss">
      <IconX class="size-4" />
    </button>
  </div>
</template>
