<script setup>
const props = defineProps({
  endpoint: { type: String, required: true },
})

const api     = useApi()
const events  = ref([])
const pending = ref(false)
const error   = ref(null)

const fetchHistory = async () => {
  pending.value = true
  error.value   = null
  try {
    const data   = await api.get(props.endpoint)
    events.value = Array.isArray(data) ? data : (data.data ?? [])
  } catch (e) {
    error.value = e
  } finally {
    pending.value = false
  }
}

const refresh = fetchHistory

watch(() => props.endpoint, fetchHistory, { immediate: true })

const typeConfig = {
  created:  { color: 'bg-green-500',  label: 'Creado',      textColor: 'text-green-600 dark:text-green-400'  },
  updated:  { color: 'bg-blue-500',   label: 'Actualizado', textColor: 'text-blue-600 dark:text-blue-400'    },
  deleted:  { color: 'bg-red-500',    label: 'Eliminado',   textColor: 'text-red-600 dark:text-red-400'      },
  restored: { color: 'bg-amber-500',  label: 'Restaurado',  textColor: 'text-amber-600 dark:text-amber-400'  },
  default:  { color: 'bg-muted-foreground', label: 'Evento', textColor: 'text-muted-foreground'              },
}

const getConfig = (type) => typeConfig[type] ?? typeConfig.default

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="px-4 py-3">

    <!-- Loading -->
    <div v-if="pending" class="flex flex-col gap-3">
      <div v-for="i in 3" :key="i" class="flex gap-3 animate-pulse">
        <div class="flex flex-col items-center gap-1 shrink-0">
          <div class="size-2.5 rounded-full bg-muted mt-1.5" />
          <div class="w-px flex-1 bg-muted min-h-8" />
        </div>
        <div class="space-y-1.5 pb-4 flex-1">
          <div class="h-3 w-24 bg-muted rounded" />
          <div class="h-3 w-40 bg-muted rounded" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-6">
      <p class="text-sm text-red-500">No se pudo cargar la bitácora</p>
      <button @click="refresh()" class="mt-2 text-xs text-muted-foreground hover:text-foreground underline">Reintentar</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!events.length" class="text-center py-8">
      <p class="text-sm text-muted-foreground">Sin registros en la bitácora</p>
    </div>

    <!-- Timeline -->
    <div v-else class="flex flex-col">
      <div
        v-for="(event, idx) in events"
        :key="event.id ?? idx"
        class="flex gap-3"
      >
        <!-- Dot + line -->
        <div class="flex flex-col items-center shrink-0">
          <div class="size-2.5 rounded-full mt-1.5 shrink-0" :class="getConfig(event.type).color" />
          <div v-if="idx < events.length - 1" class="w-px flex-1 bg-card-line min-h-4 my-1" />
        </div>

        <!-- Content -->
        <div class="pb-4 flex-1 min-w-0">
          <div class="flex items-baseline gap-2 flex-wrap">
            <span class="text-xs font-semibold" :class="getConfig(event.type).textColor">
              {{ event.action ?? getConfig(event.type).label }}
            </span>
            <span class="text-[10px] text-muted-foreground">{{ formatDate(event.created_at) }}</span>
          </div>
          <p v-if="event.description" class="text-xs text-foreground mt-0.5">{{ event.description }}</p>
          <p v-if="event.user?.name" class="text-[10px] text-muted-foreground mt-0.5">por {{ event.user.name }}</p>

          <!-- Properties diff -->
          <div v-if="event.properties && Object.keys(event.properties).length" class="mt-1.5 space-y-0.5">
            <div
              v-for="(val, field) in event.properties"
              :key="field"
              class="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-surface rounded px-1.5 py-0.5"
            >
              <span class="font-medium text-foreground">{{ field }}</span>
              <span v-if="val?.old !== undefined">
                <span class="line-through opacity-60">{{ val.old ?? '—' }}</span>
                <span class="mx-1">→</span>
                <span>{{ val.new ?? '—' }}</span>
              </span>
              <span v-else>{{ val }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
