<script setup lang="ts">
import { IconBell, IconMail, IconLock } from '@tabler/icons-vue'
import {
  CHANNELS, CHANNEL_LABELS, clonePreferences, diffPreferences, groupByCategory, togglePreference,
  type Channel, type NoticeTypePreference,
} from '../../composables/useNotificationPreferences/internal/preferences'

/*
 * Notifications.Preferences — qué avisos recibe el usuario y por qué canal (campanita/correo).
 * Los avisos críticos de cuenta se muestran bloqueados (el servidor ignora apagarlos).
 * Backend: \Innertia\Notifications\Routes::preferences() (GET|PUT me/notification-preferences).
 *
 *   <Notifications.Preferences />                                         // backoffice
 *   <Notifications.Preferences endpoint="platform/me/notification-preferences" />
 */
const props = withDefaults(defineProps<{ endpoint?: string }>(), { endpoint: 'me/notification-preferences' })

const toast = useToast()
const { query, save } = useNotificationPreferences({ base: props.endpoint })

const original = computed<NoticeTypePreference[]>(() => (query.data.value as any)?.data ?? [])
const items = ref<NoticeTypePreference[]>([])
watch(original, (v) => { items.value = clonePreferences(v) }, { immediate: true })

const changes = computed(() => diffPreferences(original.value, items.value))
const groups = computed(() => groupByCategory(items.value))
const icons: Record<Channel, any> = { bell: IconBell, mail: IconMail }

function set(key: string, channel: Channel, enabled: boolean) {
  items.value = togglePreference(items.value, key, channel, enabled)
}

async function submit() {
  if (!changes.value.length) return
  try {
    await save.mutateAsync(changes.value)
    toast.success('Preferencias guardadas.')
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'No se pudieron guardar las preferencias.')
  }
}

function discard() {
  items.value = clonePreferences(original.value)
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="query.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
    <div v-else-if="query.isError.value" class="p-8 text-center text-sm text-muted-foreground">
      No se pudieron cargar tus preferencias.
      <button type="button" class="text-primary hover:underline" @click="query.refetch()">Reintentar</button>
    </div>
    <div v-else-if="!items.length" class="p-8 text-center text-sm text-muted-foreground">No hay avisos configurables.</div>

    <template v-else>
      <div v-for="g in groups" :key="g.category" class="bg-card border border-card-line rounded-card overflow-hidden">
        <div class="flex items-center gap-3 px-5 py-3 border-b border-card-line bg-muted/30">
          <p class="flex-1 text-sm font-semibold text-foreground">{{ g.label }}</p>
          <span v-for="c in CHANNELS" :key="c" class="w-20 text-center text-xs font-medium text-muted-foreground inline-flex items-center justify-center gap-1">
            <component :is="icons[c]" class="size-3.5" :stroke-width="1.75" />{{ CHANNEL_LABELS[c] }}
          </span>
        </div>
        <ul class="divide-y divide-card-line">
          <li v-for="t in g.items" :key="t.key" class="flex items-center gap-3 px-5 py-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-foreground flex items-center gap-1.5">
                {{ t.label }}
                <IconLock v-if="t.critical" class="size-3.5 text-muted-foreground" :stroke-width="1.75" title="Aviso de seguridad: no se puede desactivar" />
              </p>
              <p v-if="t.description" class="text-xs text-muted-foreground">{{ t.description }}</p>
            </div>
            <label v-for="c in CHANNELS" :key="c" class="w-20 flex justify-center">
              <input
                type="checkbox"
                class="size-4 rounded border-card-line text-primary focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                :checked="t.preferences[c]?.enabled"
                :disabled="t.preferences[c]?.locked || !t.preferences[c]?.available"
                :aria-label="`${t.label}: ${CHANNEL_LABELS[c]}`"
                @change="set(t.key, c, ($event.target as HTMLInputElement).checked)"
              />
            </label>
          </li>
        </ul>
      </div>

      <p class="text-xs text-muted-foreground flex items-center gap-1">
        <IconLock class="size-3.5" :stroke-width="1.75" /> Los avisos de seguridad de tu cuenta siempre se envían.
      </p>

      <div class="flex justify-end gap-2">
        <App.Button v-if="changes.length" text="Descartar" severity="secondary" size="sm" @click="discard" />
        <App.Button text="Guardar" severity="primary" size="sm" :disabled="!changes.length" :loading="save.isPending.value" @click="submit" />
      </div>
    </template>
  </div>
</template>
