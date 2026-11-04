<script setup>
// Cambio de contraseña obligatorio de la cuenta de plataforma (genérico, vía layer).
// Se llega aquí cuando la cuenta entró con una clave temporal: la por defecto
// (platform@innertia.cl) o una generada con `php artisan platform:password`.
// Mientras esté pendiente, el backend responde 403 a todo lo demás y el middleware
// 05.platform-password redirige aquí.
definePageMeta({ layout: 'auth' })

const api = useApi()
const authStore = useAuthStore()
const { logout } = useAuth()

const password = ref('')
const confirmation = ref('')
const errors = reactive({ password: null, confirmation: null })
const processing = ref(false)

async function handleSubmit() {
  errors.password = null
  errors.confirmation = null
  if (password.value.length < 10) { errors.password = 'Mínimo 10 caracteres, con letras y números.'; return }
  if (password.value !== confirmation.value) { errors.confirmation = 'Las contraseñas no coinciden.'; return }

  processing.value = true
  try {
    const res = await api.post('platform/auth/password', {
      password: password.value,
      password_confirmation: confirmation.value,
    })
    authStore.saveUser({ ...(authStore.user ?? {}), ...(res?.user ?? {}), force_password_change: false })
    await navigateTo('/platform', { replace: true })
  } catch (e) {
    const body = e?.data ?? {}
    errors.password = body.errors?.password?.[0] ?? body.message ?? 'No se pudo guardar la contraseña.'
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-foreground">Define tu contraseña</h1>
      <p class="mt-1.5 text-sm text-muted-foreground">
        Entraste con una clave temporal<span v-if="authStore.user?.email"> ({{ authStore.user.email }})</span>.
        Elige una contraseña nueva para continuar a la consola.
      </p>
    </div>

    <form class="space-y-4" novalidate @submit.prevent="handleSubmit">
      <Forms.Input
        v-model="password"
        type="password"
        label="Contraseña nueva"
        autocomplete="new-password"
        hint="Mínimo 10 caracteres, con letras y números."
        :disabled="processing"
        :error="errors.password"
      />
      <Forms.Input
        v-model="confirmation"
        type="password"
        label="Repite la contraseña"
        autocomplete="new-password"
        :disabled="processing"
        :error="errors.confirmation"
      />

      <button
        type="submit"
        :disabled="processing"
        class="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      >
        {{ processing ? 'Guardando…' : 'Guardar y continuar' }}
      </button>
    </form>

    <button type="button" class="w-full text-center text-sm text-muted-foreground hover:text-foreground" @click="logout()">
      Salir
    </button>
  </div>
</template>
