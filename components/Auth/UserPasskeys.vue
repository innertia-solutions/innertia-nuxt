<script setup>
import { IconFingerprint } from '@tabler/icons-vue'

// Para administradores: passkeys de un usuario (cantidad, último uso) y
// "Revocar todas" (dispositivo perdido, funcionario que se va).
const props = defineProps({
  userId: { type: [String, Number], required: true },
})

const passkeys = usePasskeys()
const toast = useToast()
const { confirm } = useModal()
const items = ref([])
const loading = ref(true)
const revoking = ref(false)

const lastUsed = computed(() => {
  const dates = items.value.map(i => i.last_used_at).filter(Boolean).sort()
  return dates.length ? new Date(dates[dates.length - 1]).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : null
})

async function load() {
  loading.value = true
  try { items.value = await passkeys.listForUser(props.userId) } finally { loading.value = false }
}

async function revoke() {
  const ok = await confirm({ severity: 'danger', message: 'Se revocarán todas las passkeys de este usuario. Tendrá que ingresar con su contraseña. ¿Continuar?' })
  if (!ok) return
  revoking.value = true
  try {
    const n = await passkeys.revokeAll(props.userId)
    toast.success(n === 1 ? '1 passkey revocada.' : `${n} passkeys revocadas.`)
    await load()
  } catch (e) {
    toast.error(passkeys.errorMessage(e))
  } finally {
    revoking.value = false
  }
}

watch(() => props.userId, load)
onMounted(load)
</script>

<template>
  <div class="flex items-center gap-3 rounded-card border border-card-line bg-card px-5 py-4">
    <IconFingerprint class="size-5 shrink-0 text-muted-foreground" />
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium text-foreground">Passkeys</p>
      <p class="text-xs text-muted-foreground">
        <template v-if="loading">Cargando…</template>
        <template v-else-if="!items.length">No tiene passkeys.</template>
        <template v-else>
          {{ items.length === 1 ? '1 passkey' : `${items.length} passkeys` }}<template v-if="lastUsed"> · último uso {{ lastUsed }}</template>
        </template>
      </p>
    </div>
    <App.Button v-if="items.length" text="Revocar todas" severity="danger" size="sm" :loading="revoking" @click="revoke" />
  </div>
</template>
