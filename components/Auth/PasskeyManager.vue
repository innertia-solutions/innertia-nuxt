<script setup>
import { IconFingerprint, IconPencil, IconTrash, IconPlus } from '@tabler/icons-vue'

// Gestión de las passkeys propias (perfil › Seguridad). base: 'auth' | 'platform/auth'.
const props = defineProps({
  base: { type: String, default: 'auth' },
})

const passkeys = usePasskeys({ platform: props.base === 'platform/auth' })
const toast = useToast()
const { confirm } = useModal()
const items = ref([])
const loading = ref(true)
const loadError = ref('')
const adding = ref(false)
const editingId = ref(null)
const editName = ref('')
const editInput = ref(null)

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Nunca'

async function load() {
  loading.value = true
  loadError.value = ''
  if (!(await passkeys.ensureEnabled())) {
    loading.value = false
    return
  }
  try {
    items.value = await passkeys.list(props.base)
  } catch (e) {
    loadError.value = passkeys.errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function add() {
  adding.value = true
  try {
    await passkeys.register(undefined, props.base)
    toast.success('Passkey agregada.')
    await load()
  } catch (e) {
    if (!passkeys.isCancel(e)) toast.error(passkeys.errorMessage(e))
  } finally {
    adding.value = false
  }
}

async function startEdit(item) {
  editingId.value = item.id
  editName.value = item.name
  await nextTick()
  // ref dentro de v-for → arreglo
  const el = Array.isArray(editInput.value) ? editInput.value[0] : editInput.value
  el?.focus()
  el?.select()
}

// Esc cancela sin guardar: se suelta la edición ANTES del blur que provoca
// desmontar el input, así saveEdit (por blur) ve que ya no se edita y no guarda.
function cancelEdit() {
  editingId.value = null
}

async function saveEdit(item) {
  // Enter + blur: solo la primera llamada guarda (evita doble PATCH).
  if (editingId.value !== item.id) return
  editingId.value = null
  const name = editName.value.trim()
  if (!name || name === item.name) return
  const previous = item.name
  item.name = name
  try {
    await passkeys.rename(item.id, name, props.base)
  } catch (e) {
    item.name = previous
    toast.error(passkeys.errorMessage(e))
  }
}

async function removeItem(item) {
  const ok = await confirm({ severity: 'danger', message: `¿Eliminar la passkey "${item.name}"? Ya no podrás ingresar con ella.` })
  if (!ok) return
  try {
    await passkeys.remove(item.id, props.base)
    items.value = items.value.filter(i => i.id !== item.id)
    toast.success('Passkey eliminada.')
  } catch (e) {
    toast.error(passkeys.errorMessage(e))
  }
}

onMounted(load)
</script>

<template>
  <div class="rounded-card border border-card-line bg-card">
    <div class="flex items-center justify-between gap-3 border-b border-card-line px-5 py-4">
      <div>
        <h3 class="text-sm font-semibold text-foreground">Passkeys</h3>
        <p class="mt-0.5 text-xs text-muted-foreground">Ingresa con tu huella, rostro o PIN del dispositivo, sin contraseña.</p>
      </div>
      <App.Button
        v-if="passkeys.ready.value && passkeys.available.value"
        text="Agregar en este dispositivo"
        :icon="IconPlus"
        severity="primary"
        size="sm"
        :loading="adding"
        @click="add"
      />
    </div>

    <div v-if="!passkeys.ready.value" class="px-5 py-6 text-sm text-muted-foreground">Cargando…</div>

    <p v-else-if="!passkeys.enabled.value" class="px-5 py-4 text-sm text-muted-foreground">
      El ingreso con passkey está desactivado.
    </p>

    <p v-else-if="!passkeys.supported.value" class="px-5 py-4 text-sm text-muted-foreground">
      Este navegador no permite usar passkeys.
    </p>

    <div v-else-if="loading" class="px-5 py-6 text-sm text-muted-foreground">Cargando…</div>

    <div v-else-if="loadError" class="flex items-center justify-between gap-3 px-5 py-6" role="alert">
      <p class="text-sm text-red-600">{{ loadError }}</p>
      <App.Button text="Reintentar" size="sm" @click="load" />
    </div>

    <p v-else-if="!items.length" class="px-5 py-6 text-sm text-muted-foreground">
      Aún no tienes passkeys. Agrega una para ingresar con tu huella.
    </p>

    <ul v-else class="divide-y divide-card-line">
      <li v-for="item in items" :key="item.id" class="flex items-center gap-3 px-5 py-3">
        <IconFingerprint class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <input
            v-if="editingId === item.id"
            ref="editInput"
            v-model="editName"
            maxlength="120"
            :aria-label="`Nuevo nombre para la passkey ${item.name}`"
            class="w-full rounded-control border border-card-line bg-transparent px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            @keydown.enter.prevent="saveEdit(item)"
            @keydown.esc.prevent.stop="cancelEdit"
            @blur="saveEdit(item)"
          />
          <p v-else class="truncate text-sm font-medium text-foreground">{{ item.name }}</p>
          <p class="text-xs text-muted-foreground">
            <span v-if="item.provider">{{ item.provider }} · </span>Creada {{ fmt(item.created_at) }} · Último uso {{ fmt(item.last_used_at) }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-control p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          :aria-label="`Renombrar passkey ${item.name}`"
          @click="startEdit(item)"
        >
          <IconPencil class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="rounded-control p-1 text-muted-foreground hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
          :aria-label="`Eliminar passkey ${item.name}`"
          @click="removeItem(item)"
        >
          <IconTrash class="size-4" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>
