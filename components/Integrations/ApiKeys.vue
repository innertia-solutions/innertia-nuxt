<script setup lang="ts">
import { IconKey, IconPlus, IconRefresh, IconBan, IconAlertTriangle, IconBook } from '@tabler/icons-vue'
import {
  apiKeyStatus, groupScopes, toggleValue, expiryLabel, relativeTime, formatDateTime, httpSeverity,
  EXPIRY_PRESETS, expiryFromPreset, appendPage, type ApiKey,
} from '../../composables/useIntegrations/internal/integrations'

/*
 * Integrations.ApiKeys — API keys of the active space: list, create (scopes, optional site,
 * expiry), key shown ONCE, request log, rotate (24 h coexistence) and revoke.
 * Backend: \Innertia\PublicApi\Routes::manage() (GET|POST api-keys, …).
 *
 *   <Integrations.ApiKeys :organizations="sites" developers-url="/developers" />
 */
const props = withDefaults(defineProps<{
  endpoint?: string
  organizations?: { value: string | number; label: string }[]
  canManage?: boolean
  developersUrl?: string
}>(), { endpoint: 'integrations', organizations: () => [], canManage: true, developersUrl: '' })

const toast = useToast()
const { confirm } = useModal()
const { list, scopes, create, rotate, revoke, requests } = useApiKeys({ base: props.endpoint })

const keys = computed<ApiKey[]>(() => (list.data.value as ApiKey[] | undefined) ?? [])
const scopeGroups = computed(() => groupScopes((scopes.data.value as any[]) ?? []))
const orgLabel = (id: any) => props.organizations.find(o => String(o.value) === String(id))?.label ?? id

const errorMessage = (e: any, fallback: string) =>
  e?.data?.message ?? (e?.data?.errors ? Object.values(e.data.errors).flat()[0] : null) ?? fallback

// ── Create ──────────────────────────────────────────────────────────────────
const showCreate = ref(false)
const form = reactive({ name: '', scopes: [] as string[], organization_id: '' as string | number, expiry: '' })

function openCreate() {
  Object.assign(form, { name: '', scopes: [], organization_id: '', expiry: '' })
  showCreate.value = true
}

async function submitCreate() {
  if (!form.name.trim() || !form.scopes.length) return
  try {
    const res = await create.mutateAsync({
      name: form.name.trim(),
      scopes: form.scopes,
      organization_id: form.organization_id === '' ? null : form.organization_id,
      expires_at: expiryFromPreset(form.expiry),
    })
    showCreate.value = false
    revealSecret(res.secret, 'API key creada')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo crear la API key.'))
  }
}

// ── Secret shown once ───────────────────────────────────────────────────────
const secret = ref<{ value: string; title: string; note?: string } | null>(null)
function revealSecret(value: string, title: string, note?: string) {
  secret.value = { value, title, note }
}

// ── Rotate / revoke ─────────────────────────────────────────────────────────
async function doRotate(k: ApiKey) {
  const ok = await confirm({
    severity: 'warning',
    title: 'Rotar API key',
    message: `Se generará una clave nueva para "${k.name}". La actual seguirá funcionando 24 horas para que alcances a reemplazarla en tu integración.`,
    confirmText: 'Rotar',
  })
  if (!ok) return
  try {
    const res = await rotate.mutateAsync(k.id)
    if (detail.value?.id === k.id) detail.value = null
    revealSecret(res.secret, 'Nueva API key',
      res.previous?.expires_at ? `La clave anterior deja de funcionar ${relativeTime(res.previous.expires_at)} (${formatDateTime(res.previous.expires_at)}).` : undefined)
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo rotar la API key.'))
  }
}

async function doRevoke(k: ApiKey) {
  const ok = await confirm({
    severity: 'danger',
    title: 'Revocar API key',
    message: `"${k.name}" dejará de funcionar de inmediato. Esta acción no se puede deshacer.`,
    confirmText: 'Revocar',
  })
  if (!ok) return
  try {
    await revoke.mutateAsync(k.id)
    if (detail.value?.id === k.id) detail.value = null
    toast.success('API key revocada.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo revocar la API key.'))
  }
}

// ── Detail + request log ────────────────────────────────────────────────────
const detail = ref<ApiKey | null>(null)
const log = reactive({ items: [] as any[], cursor: null as string | null, loading: false, loaded: false })

async function openDetail(k: ApiKey) {
  detail.value = k
  Object.assign(log, { items: [], cursor: null, loading: false, loaded: false })
  await loadMore()
}

async function loadMore() {
  if (!detail.value || log.loading) return
  log.loading = true
  try {
    const res = await requests(detail.value.id, log.cursor)
    log.items = appendPage(log.items, res?.data ?? [])
    log.cursor = res?.meta?.next_cursor ?? null
  } catch {
    toast.error('No se pudo cargar el registro de uso.')
  } finally {
    log.loading = false
    log.loaded = true
  }
}

const showDetail = computed({ get: () => detail.value !== null, set: (v) => { if (!v) detail.value = null } })
const showSecret = computed({ get: () => secret.value !== null, set: (v) => { if (!v) secret.value = null } })
const inputClass = 'w-full h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <p class="flex-1 text-sm text-muted-foreground">
        Las API keys permiten que sistemas externos consulten y operen este espacio. Cada clave tiene permisos (scopes) acotados.
      </p>
      <a v-if="developersUrl" :href="developersUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <IconBook class="size-4" :stroke-width="1.75" /> Documentación de la API
      </a>
      <App.Button v-if="canManage" text="Nueva API key" severity="primary" size="sm" :icon="IconPlus" @click="openCreate" />
    </div>

    <div class="bg-card border border-card-line rounded-card overflow-hidden">
      <div v-if="list.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="list.isError.value" class="p-8 text-center text-sm text-muted-foreground">
        No se pudieron cargar las API keys.
        <button type="button" class="text-primary hover:underline" @click="list.refetch()">Reintentar</button>
      </div>
      <div v-else-if="!keys.length" class="p-8 text-center text-sm text-muted-foreground">
        <IconKey class="size-6 mx-auto mb-2 text-muted-foreground" :stroke-width="1.5" />
        Aún no hay API keys.
      </div>
      <ul v-else class="divide-y divide-card-line">
        <li v-for="k in keys" :key="k.id" class="flex flex-wrap items-center gap-3 px-5 py-3">
          <button type="button" class="flex-1 min-w-0 text-left" @click="openDetail(k)">
            <p class="text-sm font-medium text-foreground flex items-center gap-2">
              {{ k.name }}
              <App.Tag :text="apiKeyStatus(k.status).label" :severity="apiKeyStatus(k.status).severity" size="xs" />
            </p>
            <p class="text-xs text-muted-foreground font-mono">{{ k.prefix }}{{ k.hint ? ` ${k.hint}` : '' }}</p>
            <p class="text-xs text-muted-foreground">
              {{ k.scopes.length }} {{ k.scopes.length === 1 ? 'permiso' : 'permisos' }}
              <template v-if="k.organization_id"> · Sede {{ orgLabel(k.organization_id) }}</template>
              · {{ expiryLabel(k.expires_at) }}
              · Último uso {{ k.last_used_at ? relativeTime(k.last_used_at) : 'nunca' }}
            </p>
          </button>
          <div v-if="canManage && (k.status === 'active' || k.status === 'expiring')" class="flex gap-2">
            <App.Button text="Rotar" size="xs" :icon="IconRefresh" @click="doRotate(k)" />
            <App.Button text="Revocar" size="xs" severity="danger" outline :icon="IconBan" @click="doRevoke(k)" />
          </div>
        </li>
      </ul>
    </div>

    <!-- Create -->
    <Modal v-model="showCreate" title="Nueva API key" size="lg" show-footer>
      <form class="space-y-4" @submit.prevent="submitCreate">
        <label class="block space-y-1">
          <span class="text-sm font-medium text-foreground">Nombre</span>
          <input v-model="form.name" type="text" maxlength="100" placeholder="Ej: ERP, Panel de reportes" :class="inputClass" />
        </label>

        <label v-if="organizations.length" class="block space-y-1">
          <span class="text-sm font-medium text-foreground">Sede</span>
          <select v-model="form.organization_id" :class="inputClass">
            <option value="">Todas las sedes</option>
            <option v-for="o in organizations" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <span class="text-xs text-muted-foreground">Limita la clave a los datos de una sede.</span>
        </label>

        <label class="block space-y-1">
          <span class="text-sm font-medium text-foreground">Vencimiento</span>
          <select v-model="form.expiry" :class="inputClass">
            <option v-for="p in EXPIRY_PRESETS" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </label>

        <div class="space-y-2">
          <span class="text-sm font-medium text-foreground">Permisos</span>
          <div v-if="scopes.isPending.value" class="text-sm text-muted-foreground">Cargando permisos…</div>
          <div v-else class="border border-card-line rounded-card divide-y divide-card-line">
            <div v-for="g in scopeGroups" :key="g.group" class="px-4 py-2">
              <p class="text-xs font-semibold uppercase text-muted-foreground mb-1">{{ g.group }}</p>
              <label v-for="s in g.items" :key="s.key" class="flex items-start gap-2 py-1">
                <input
                  type="checkbox"
                  class="mt-0.5 size-4 rounded border-card-line text-primary focus:ring-primary/30"
                  :checked="form.scopes.includes(s.key)"
                  @change="form.scopes = toggleValue(form.scopes, s.key, ($event.target as HTMLInputElement).checked)"
                />
                <span class="text-sm">
                  <code class="text-xs font-mono text-foreground">{{ s.key }}</code>
                  <span v-if="s.description" class="block text-xs text-muted-foreground">{{ s.description }}</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <App.Button text="Cancelar" size="sm" @click="showCreate = false" />
          <App.Button text="Crear API key" severity="primary" size="sm" :disabled="!form.name.trim() || !form.scopes.length" :loading="create.isPending.value" @click="submitCreate" />
        </div>
      </template>
    </Modal>

    <!-- Secret (once) -->
    <Modal v-model="showSecret" :title="secret?.title ?? ''" size="lg" show-footer :backdrop-dismiss="false">
      <div v-if="secret" class="space-y-3">
        <div class="flex items-start gap-2 rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <IconAlertTriangle class="size-5 shrink-0 text-amber-500" :stroke-width="1.75" />
          <span>Copia la clave ahora: <strong>no se volverá a mostrar</strong>. Guárdala en un lugar seguro (gestor de secretos).</span>
        </div>
        <div class="flex items-center gap-2 rounded-control border border-card-line bg-muted/30 px-3 py-2">
          <code class="flex-1 break-all text-sm font-mono text-foreground">{{ secret.value }}</code>
          <CopyButton :value="secret.value" />
        </div>
        <p v-if="secret.note" class="text-xs text-muted-foreground">{{ secret.note }}</p>
        <p class="text-xs text-muted-foreground">Úsala en el header <code class="font-mono">Authorization: Bearer &lt;clave&gt;</code>.</p>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <App.Button text="Ya la copié" severity="primary" size="sm" @click="secret = null" />
        </div>
      </template>
    </Modal>

    <!-- Detail -->
    <Modal v-model="showDetail" :title="detail?.name ?? ''" size="3xl" variant="drawer-right">
      <div v-if="detail" class="space-y-5">
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div><dt class="text-xs text-muted-foreground">Estado</dt><dd><App.Tag :text="apiKeyStatus(detail.status).label" :severity="apiKeyStatus(detail.status).severity" size="xs" /></dd></div>
          <div><dt class="text-xs text-muted-foreground">Clave</dt><dd class="font-mono">{{ detail.prefix }} {{ detail.hint }}</dd></div>
          <div><dt class="text-xs text-muted-foreground">Vencimiento</dt><dd>{{ expiryLabel(detail.expires_at) }}</dd></div>
          <div><dt class="text-xs text-muted-foreground">Último uso</dt><dd>{{ formatDateTime(detail.last_used_at) }}<span v-if="detail.last_used_ip" class="text-muted-foreground"> · {{ detail.last_used_ip }}</span></dd></div>
          <div v-if="detail.organization_id"><dt class="text-xs text-muted-foreground">Sede</dt><dd>{{ orgLabel(detail.organization_id) }}</dd></div>
          <div><dt class="text-xs text-muted-foreground">Creada</dt><dd>{{ formatDateTime(detail.created_at) }}</dd></div>
          <div class="col-span-2">
            <dt class="text-xs text-muted-foreground mb-1">Permisos</dt>
            <dd class="flex flex-wrap gap-1"><code v-for="s in detail.scopes" :key="s" class="text-xs font-mono rounded bg-muted px-1.5 py-0.5">{{ s }}</code></dd>
          </div>
        </dl>

        <div v-if="canManage && (detail.status === 'active' || detail.status === 'expiring')" class="flex gap-2">
          <App.Button text="Rotar" size="xs" :icon="IconRefresh" @click="doRotate(detail)" />
          <App.Button text="Revocar" size="xs" severity="danger" outline :icon="IconBan" @click="doRevoke(detail)" />
        </div>

        <div>
          <p class="text-sm font-semibold text-foreground mb-2">Registro de uso (30 días)</p>
          <div class="border border-card-line rounded-card overflow-hidden">
            <div v-if="log.loaded && !log.items.length" class="p-6 text-center text-sm text-muted-foreground">Sin solicitudes registradas.</div>
            <table v-else class="w-full text-sm">
              <thead class="bg-muted/30 text-xs text-muted-foreground">
                <tr><th class="text-left px-3 py-2">Fecha</th><th class="text-left px-3 py-2">Solicitud</th><th class="text-left px-3 py-2">Estado</th><th class="text-right px-3 py-2">ms</th></tr>
              </thead>
              <tbody class="divide-y divide-card-line">
                <tr v-for="r in log.items" :key="r.id">
                  <td class="px-3 py-2 whitespace-nowrap text-muted-foreground">{{ formatDateTime(r.created_at) }}</td>
                  <td class="px-3 py-2 font-mono text-xs break-all">{{ r.method }} {{ r.path }}</td>
                  <td class="px-3 py-2"><App.Tag :text="String(r.status)" :severity="httpSeverity(r.status)" size="xs" /></td>
                  <td class="px-3 py-2 text-right text-muted-foreground">{{ r.duration_ms ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-2 flex justify-center">
            <App.Button v-if="log.cursor" text="Cargar más" size="xs" :loading="log.loading" @click="loadMore" />
            <span v-else-if="log.loading" class="text-xs text-muted-foreground">Cargando…</span>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>
