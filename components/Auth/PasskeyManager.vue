<script setup>
import { IconFingerprint, IconPencil, IconTrash, IconPlus } from '@tabler/icons-vue'

// Gestión de las passkeys propias (perfil › Seguridad). base: 'auth' | 'platform/auth'.
const props = defineProps({
  base: { type: String, default: 'auth' },
})

const passkeys = usePasskeys()
const toast = useToast()
const { confirm } = useModal()
const items = ref([])
const loading = ref(true)
const adding = ref(false)
const editingId = ref(null)
const editName = ref('')

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Nunca'

async function load() {
  loading.value = true
  try { items.value = await passkeys.list(props.base) } finally { loading.value = false }
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

function startEdit(item) {
  editingId.value = item.id
  editName.value = item.name
}

async function saveEdit(item) {
  const name = editName.value.trim()
  if (!name || name === item.name) { editingId.value = null; return }
  try {
    await passkeys.rename(item.id, name, props.base)
    item.name = name
  } catch (e) {
    toast.error(passkeys.errorMessage(e))
  } finally {
    editingId.value = null
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
        v-if="passkeys.supported.value"
        text="Agregar en este dispositivo"
        :icon="IconPlus"
        severity="primary"
        size="sm"
        :loading="adding"
        @click="add"
      />
    </div>

    <p v-if="!passkeys.supported.value" class="px-5 py-4 text-sm text-muted-foreground">
      Este navegador no permite usar passkeys.
    </p>

    <div v-else-if="loading" class="px-5 py-6 text-sm text-muted-foreground">Cargando…</div>

    <p v-else-if="!items.length" class="px-5 py-6 text-sm text-muted-foreground">
      Aún no tienes passkeys. Agrega una para ingresar con tu huella.
    </p>

    <ul v-else class="divide-y divide-card-line">
      <li v-for="item in items" :key="item.id" class="flex items-center gap-3 px-5 py-3">
        <IconFingerprint class="size-5 shrink-0 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <input
            v-if="editingId === item.id"
            v-model="editName"
            maxlength="120"
            class="w-full rounded-lg border border-card-line bg-transparent px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none"
            @keydown.enter.prevent="saveEdit(item)"
            @keydown.esc="editingId = null"
            @blur="saveEdit(item)"
          />
          <p v-else class="truncate text-sm font-medium text-foreground">{{ item.name }}</p>
          <p class="text-xs text-muted-foreground">
            <span v-if="item.provider">{{ item.provider }} · </span>Creada {{ fmt(item.created_at) }} · Último uso {{ fmt(item.last_used_at) }}
          </p>
        </div>
        <button type="button" class="text-muted-foreground hover:text-foreground" aria-label="Renombrar" @click="startEdit(item)">
          <IconPencil class="size-4" />
        </button>
        <button type="button" class="text-muted-foreground hover:text-red-600" aria-label="Eliminar" @click="removeItem(item)">
          <IconTrash class="size-4" />
        </button>
      </li>
    </ul>
  </div>
</template>
