<script setup lang="ts">
import { IconSend, IconSearch } from '@tabler/icons-vue'

/*
 * Platform.Emails — registro de correos enviados (/platform/emails).
 * Backend: \Innertia\Mail\Routes::platform('') → GET emails, GET emails/types.
 * Filtros: búsqueda (destinatario/asunto), estado, tipo y espacio. Los fallidos muestran el motivo.
 *
 *   <Platform.Emails />
 *   <Platform.Emails :tenants="[{ value: 'uuid', label: 'Rancagua' }]" />
 */
const props = withDefaults(defineProps<{
  endpoint?: string
  tenants?: { value: string; label: string }[]
}>(), { endpoint: 'platform/emails', tenants: () => [] })

const api = useApi()
const base = props.endpoint.replace(/^\/+|\/+$/g, '')

const search = ref('')
const status = ref<string | null>('')
const type = ref<string | null>('')
const tenant = ref<string | null>('')
const page = ref(1)
const expanded = ref<string | null>(null)

const params = computed(() => ({
  page: page.value,
  ...(search.value ? { search: search.value } : {}),
  ...(status.value ? { status: status.value } : {}),
  ...(type.value ? { type: type.value } : {}),
  ...(tenant.value ? { tenant_id: tenant.value } : {}),
}))

const { data, isPending } = useQuery({
  queryKey: computed(() => ['platform', 'emails', base, params.value]),
  queryFn: () => api.get(base, { params: params.value }),
  placeholderData: (prev: any) => prev,
})
const { data: typesData } = useQuery({ queryKey: ['platform', 'emails', base, 'types'], queryFn: () => api.get(`${base}/types`) })

const rows = computed<any[]>(() => (data.value as any)?.data ?? [])
const lastPage = computed(() => (data.value as any)?.last_page ?? 1)
const typeOptions = computed(() => ((typesData.value as any)?.data ?? []).map((t: string) => ({ value: t, label: t })))

watch([search, status, type, tenant], () => { page.value = 1 })

const STATUS: Record<string, { label: string; class: string }> = {
  queued:  { label: 'En cola',   class: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  sent:    { label: 'Enviado',   class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  failed:  { label: 'Fallido',   class: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
  pending: { label: 'Pendiente', class: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300' },
}

function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-3">
      <div class="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <IconSend class="size-5" :stroke-width="1.5" />
      </div>
      <div>
        <h1 class="text-lg font-semibold text-foreground">Correos enviados</h1>
        <p class="text-sm text-muted-foreground">Registro de los correos que envía la plataforma.</p>
      </div>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <div class="relative flex-1 min-w-56">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          v-model="search"
          type="search"
          placeholder="Buscar por destinatario o asunto…"
          class="w-full pl-9 pr-3 h-9 rounded-control border border-card-line bg-card text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div class="w-44"><Forms.Select v-model="status" placeholder="Todos los estados" :options="[{ value: 'sent', label: 'Enviado' }, { value: 'queued', label: 'En cola' }, { value: 'failed', label: 'Fallido' }]" /></div>
      <div class="w-56"><Forms.Select :key="typeOptions.length" v-model="type" placeholder="Todos los tipos" :options="typeOptions" /></div>
      <div v-if="tenants.length" class="w-56"><Forms.Select v-model="tenant" placeholder="Todos los espacios" :options="tenants" /></div>
    </div>

    <div class="bg-card border border-card-line rounded-card overflow-hidden">
      <div v-if="isPending" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="!rows.length" class="p-10 text-center text-sm text-muted-foreground">Sin correos registrados.</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[720px] text-sm">
          <thead class="bg-muted/40 text-muted-foreground">
            <tr class="text-left">
              <th class="font-medium px-4 py-2.5">Fecha</th>
              <th class="font-medium px-4 py-2.5">Destinatario</th>
              <th class="font-medium px-4 py-2.5">Asunto</th>
              <th class="font-medium px-4 py-2.5">Tipo</th>
              <th class="font-medium px-4 py-2.5">Espacio</th>
              <th class="font-medium px-4 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-card-line">
            <template v-for="r in rows" :key="r.id">
              <tr class="hover:bg-muted/30" :class="{ 'cursor-pointer': r.exception }" @click="r.exception && (expanded = expanded === r.id ? null : r.id)">
                <td class="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{{ fmtDate(r.sent_at ?? r.created_at) }}</td>
                <td class="px-4 py-2.5 text-foreground break-all">{{ r.to }}</td>
                <td class="px-4 py-2.5 text-foreground">{{ r.subject }}</td>
                <td class="px-4 py-2.5 text-muted-foreground font-mono text-xs">{{ r.type ?? '—' }}</td>
                <td class="px-4 py-2.5 text-muted-foreground">{{ r.tenant_name ?? (r.tenant_id ? r.tenant_id : 'Plataforma') }}</td>
                <td class="px-4 py-2.5">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="STATUS[r.status]?.class ?? STATUS.pending.class">
                    {{ STATUS[r.status]?.label ?? r.status }}
                  </span>
                </td>
              </tr>
              <tr v-if="expanded === r.id && r.exception">
                <td colspan="6" class="px-4 py-3 bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300 break-all">
                  <span class="font-medium">Motivo:</span> {{ r.exception }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="lastPage > 1" class="flex items-center justify-end gap-2">
      <App.Button text="Anterior" severity="secondary" size="sm" :disabled="page <= 1" @click="page--" />
      <span class="text-xs text-muted-foreground">Página {{ page }} de {{ lastPage }}</span>
      <App.Button text="Siguiente" severity="secondary" size="sm" :disabled="page >= lastPage" @click="page++" />
    </div>
  </div>
</template>
