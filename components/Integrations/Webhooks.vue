<script setup lang="ts">
import { IconWebhook, IconPlus, IconRefresh, IconTrash, IconSend, IconAlertTriangle, IconBook, IconPlayerPause, IconPlayerPlay, IconPencil } from '@tabler/icons-vue'
import {
  webhookState, deliveryStatus, httpSeverity, groupEvents, toggleFamily, toggleEvent, familyState, isEventSelected,
  groupScopes, toggleValue, validateWebhookUrl, relativeTime, formatDateTime, appendPage, prettyJson,
  type Webhook, type WebhookEvent, type WebhookLog,
} from '../../composables/useIntegrations/internal/integrations'

/*
 * Integrations.Webhooks — outbound webhooks of the active space: list, create/edit (https URL,
 * events with `family.*` wildcards, optional site, sensitive-data scopes), secret shown ONCE,
 * delivery log with resend, test event, secret rotation (24 h double signature), pause/enable, delete.
 * Backend: \Innertia\PublicApi\Routes::manage() (GET|POST webhooks, …).
 *
 *   <Integrations.Webhooks :organizations="sites" developers-url="/developers" />
 */
const props = withDefaults(defineProps<{
  endpoint?: string
  organizations?: { value: string | number; label: string }[]
  canManage?: boolean
  developersUrl?: string
}>(), { endpoint: 'integrations', organizations: () => [], canManage: true, developersUrl: '' })

const toast = useToast()
const { confirm } = useModal()
const wh = useWebhooks({ base: props.endpoint })
const keysApi = useApiKeys({ base: props.endpoint })

const hooks = computed<Webhook[]>(() => (wh.list.data.value as Webhook[] | undefined) ?? [])
const catalog = computed<WebhookEvent[]>(() => (wh.events.data.value as WebhookEvent[] | undefined) ?? [])
const eventGroups = computed(() => groupEvents(catalog.value))
// Sensitive-data scopes the subscription may receive (e.g. people:pii, recordings:read): only those
// that some event declares.
const sensitiveScopes = computed(() => {
  const declared = new Set(catalog.value.map(e => e.scope).filter(Boolean) as string[])
  const all = ((keysApi.scopes.data.value as any[]) ?? []).filter(s => declared.has(s.key))
  const known = new Set(all.map(s => s.key))
  for (const s of declared) if (!known.has(s)) all.push({ key: s })
  return groupScopes(all)
})
const orgLabel = (id: any) => props.organizations.find(o => String(o.value) === String(id))?.label ?? id

const errorMessage = (e: any, fallback: string) =>
  e?.data?.message ?? (e?.data?.errors ? Object.values(e.data.errors).flat()[0] : null) ?? fallback

// ── Create / edit ───────────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<Webhook | null>(null)
const form = reactive({ url: '', description: '', events: [] as string[], organization_id: '' as string | number, scopes: [] as string[] })
const urlError = computed(() => (form.url ? validateWebhookUrl(form.url) : null))
const canSubmit = computed(() => !validateWebhookUrl(form.url) && form.events.length > 0)
const saving = computed(() => wh.create.isPending.value || wh.update.isPending.value)

function openCreate() {
  editing.value = null
  Object.assign(form, { url: '', description: '', events: [], organization_id: '', scopes: [] })
  showForm.value = true
}

function openEdit(w: Webhook) {
  editing.value = w
  Object.assign(form, {
    url: w.url, description: w.description ?? '', events: [...w.events],
    organization_id: w.organization_id ?? '', scopes: [...(w.scopes ?? [])],
  })
  showForm.value = true
}

async function submitForm() {
  if (!canSubmit.value) return
  const body = {
    url: form.url.trim(),
    description: form.description.trim() || null,
    events: form.events,
    organization_id: form.organization_id === '' ? null : form.organization_id,
    scopes: form.scopes,
  }
  try {
    if (editing.value) {
      const res = await wh.update.mutateAsync({ id: editing.value.id, ...body })
      if (detail.value?.id === editing.value.id) detail.value = res.data
      showForm.value = false
      toast.success('Webhook actualizado.')
    } else {
      const res = await wh.create.mutateAsync({ ...body, active: true })
      showForm.value = false
      secret.value = { value: res.secret, title: 'Webhook creado' }
    }
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo guardar el webhook.'))
  }
}

// ── Secret shown once ───────────────────────────────────────────────────────
const secret = ref<{ value: string; title: string; note?: string } | null>(null)
const showSecret = computed({ get: () => secret.value !== null, set: (v) => { if (!v) secret.value = null } })

// ── Actions ─────────────────────────────────────────────────────────────────
async function setActive(w: Webhook, active: boolean) {
  try {
    const res = await wh.update.mutateAsync({ id: w.id, active })
    if (detail.value?.id === w.id) detail.value = res.data
    toast.success(active ? 'Webhook activado.' : 'Webhook pausado.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo actualizar el webhook.'))
  }
}

async function doRotate(w: Webhook) {
  const ok = await confirm({
    severity: 'warning',
    title: 'Rotar secreto',
    message: 'Se generará un secreto nuevo. Durante 24 horas cada entrega irá firmada con el secreto nuevo y con el anterior, para que alcances a actualizar tu receptor.',
    confirmText: 'Rotar',
  })
  if (!ok) return
  try {
    const res = await wh.rotateSecret.mutateAsync(w.id)
    if (detail.value?.id === w.id) detail.value = res.data
    secret.value = {
      value: res.secret, title: 'Nuevo secreto',
      note: res.data?.previous_secret_expires_at ? `El secreto anterior se deja de usar ${relativeTime(res.data.previous_secret_expires_at)}.` : undefined,
    }
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo rotar el secreto.'))
  }
}

async function doDelete(w: Webhook) {
  const ok = await confirm({
    severity: 'danger',
    title: 'Eliminar webhook',
    message: `Se dejarán de enviar eventos a ${w.url}. Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
  })
  if (!ok) return
  try {
    await wh.remove.mutateAsync(w.id)
    if (detail.value?.id === w.id) detail.value = null
    toast.success('Webhook eliminado.')
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo eliminar el webhook.'))
  }
}

async function doTest(w: Webhook) {
  try {
    await wh.test.mutateAsync(w.id)
    toast.success('Evento de prueba encolado.')
    if (detail.value?.id === w.id) setTimeout(reloadLogs, 1500)
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo enviar el evento de prueba.'))
  }
}

// ── Detail + delivery log ───────────────────────────────────────────────────
const detail = ref<Webhook | null>(null)
const showDetail = computed({ get: () => detail.value !== null, set: (v) => { if (!v) detail.value = null } })
const logs = reactive({ items: [] as WebhookLog[], cursor: null as string | null, status: '', loading: false, loaded: false })
const openLog = ref<(WebhookLog & { payload?: any; request_headers?: any; response_body?: string | null }) | null>(null)

async function openDetail(w: Webhook) {
  detail.value = w
  openLog.value = null
  await reloadLogs()
}

async function reloadLogs() {
  Object.assign(logs, { items: [], cursor: null, loaded: false })
  await loadMore()
}

async function loadMore() {
  if (!detail.value || logs.loading) return
  logs.loading = true
  try {
    const res = await wh.logs(detail.value.id, { cursor: logs.cursor, status: logs.status || undefined })
    logs.items = appendPage(logs.items, res?.data ?? [])
    logs.cursor = res?.meta?.next_cursor ?? null
  } catch {
    toast.error('No se pudo cargar el registro de entregas.')
  } finally {
    logs.loading = false
    logs.loaded = true
  }
}

async function toggleLog(l: WebhookLog) {
  if (openLog.value?.id === l.id) { openLog.value = null; return }
  try {
    const res = await wh.log(detail.value!.id, l.id)
    openLog.value = res?.data ?? null
  } catch {
    toast.error('No se pudo cargar la entrega.')
  }
}

async function doResend(l: WebhookLog) {
  try {
    await wh.resend.mutateAsync({ id: detail.value!.id, logId: l.id })
    toast.success('Reenvío encolado.')
    setTimeout(reloadLogs, 1500)
  } catch (e: any) {
    toast.error(errorMessage(e, 'No se pudo reenviar la entrega.'))
  }
}

const inputClass = 'w-full h-9 rounded-control border border-card-line bg-card text-sm text-foreground px-3 focus:outline-hidden focus:ring-2 focus:ring-primary/30'
const checkClass = 'size-4 rounded border-card-line text-primary focus:ring-primary/30'
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <p class="flex-1 text-sm text-muted-foreground">
        Los webhooks avisan a tus sistemas cuando ocurre algo (POST JSON firmado con <em>Standard Webhooks</em>). Reintentamos durante ~24 horas antes de desactivar.
      </p>
      <a v-if="developersUrl" :href="developersUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <IconBook class="size-4" :stroke-width="1.75" /> Documentación de la API
      </a>
      <App.Button v-if="canManage" text="Nuevo webhook" severity="primary" size="sm" :icon="IconPlus" @click="openCreate" />
    </div>

    <div class="bg-card border border-card-line rounded-card overflow-hidden">
      <div v-if="wh.list.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="wh.list.isError.value" class="p-8 text-center text-sm text-muted-foreground">
        No se pudieron cargar los webhooks.
        <button type="button" class="text-primary hover:underline" @click="wh.list.refetch()">Reintentar</button>
      </div>
      <div v-else-if="!hooks.length" class="p-8 text-center text-sm text-muted-foreground">
        <IconWebhook class="size-6 mx-auto mb-2 text-muted-foreground" :stroke-width="1.5" />
        Aún no hay webhooks.
      </div>
      <ul v-else class="divide-y divide-card-line">
        <li v-for="w in hooks" :key="w.id" class="flex flex-wrap items-center gap-3 px-5 py-3">
          <button type="button" class="flex-1 min-w-0 text-left" @click="openDetail(w)">
            <p class="text-sm font-medium text-foreground flex items-center gap-2 min-w-0">
              <span class="truncate font-mono">{{ w.url }}</span>
              <App.Tag :text="webhookState(w).label" :severity="webhookState(w).severity" size="xs" />
            </p>
            <p class="text-xs text-muted-foreground truncate">
              <template v-if="w.description">{{ w.description }} · </template>
              {{ w.events.join(', ') }}
              <template v-if="w.organization_id"> · Sede {{ orgLabel(w.organization_id) }}</template>
            </p>
            <p v-if="w.disabled_at && w.disabled_reason" class="text-xs text-destructive">{{ w.disabled_reason }}</p>
          </button>
          <div v-if="canManage" class="flex gap-2">
            <App.Button text="Probar" size="xs" :icon="IconSend" :disabled="!w.active" @click="doTest(w)" />
            <App.Button v-if="w.active" text="Pausar" size="xs" :icon="IconPlayerPause" @click="setActive(w, false)" />
            <App.Button v-else text="Activar" size="xs" :icon="IconPlayerPlay" @click="setActive(w, true)" />
          </div>
        </li>
      </ul>
    </div>

    <!-- Create / edit -->
    <Modal v-model="showForm" :title="editing ? 'Editar webhook' : 'Nuevo webhook'" size="2xl" show-footer>
      <form class="space-y-4" @submit.prevent="submitForm">
        <label class="block space-y-1">
          <span class="text-sm font-medium text-foreground">URL del receptor</span>
          <input v-model="form.url" type="url" placeholder="https://tu-sistema.cl/webhooks/innertia" :class="inputClass" />
          <span v-if="urlError" class="text-xs text-destructive">{{ urlError }}</span>
          <span v-else class="text-xs text-muted-foreground">Debe ser https y públicamente accesible.</span>
        </label>

        <label class="block space-y-1">
          <span class="text-sm font-medium text-foreground">Descripción</span>
          <input v-model="form.description" type="text" maxlength="255" placeholder="Opcional" :class="inputClass" />
        </label>

        <label v-if="organizations.length" class="block space-y-1">
          <span class="text-sm font-medium text-foreground">Sede</span>
          <select v-model="form.organization_id" :class="inputClass">
            <option value="">Todas las sedes</option>
            <option v-for="o in organizations" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>

        <div class="space-y-2">
          <span class="text-sm font-medium text-foreground">Eventos</span>
          <div v-if="wh.events.isPending.value" class="text-sm text-muted-foreground">Cargando eventos…</div>
          <div v-else-if="!eventGroups.length" class="text-sm text-muted-foreground">No hay eventos disponibles.</div>
          <div v-else class="border border-card-line rounded-card divide-y divide-card-line">
            <div v-for="g in eventGroups" :key="g.family" class="px-4 py-2">
              <label class="flex items-center gap-2 py-1">
                <input
                  type="checkbox" :class="checkClass"
                  :checked="familyState(form.events, g.family, catalog) === 'all'"
                  :indeterminate="familyState(form.events, g.family, catalog) === 'some'"
                  @change="form.events = toggleFamily(form.events, g.family, ($event.target as HTMLInputElement).checked)"
                />
                <code class="text-xs font-mono font-semibold text-foreground">{{ g.family }}.*</code>
                <span class="text-xs text-muted-foreground">todos</span>
              </label>
              <label v-for="e in g.items" :key="e.key" class="flex items-start gap-2 py-1 pl-6">
                <input
                  type="checkbox" :class="[checkClass, 'mt-0.5']"
                  :checked="isEventSelected(form.events, e.key)"
                  @change="form.events = toggleEvent(form.events, e.key, ($event.target as HTMLInputElement).checked, catalog)"
                />
                <span class="text-sm">
                  <code class="text-xs font-mono text-foreground">{{ e.key }}</code>
                  <span v-if="e.scope" class="ml-1 text-[11px] text-muted-foreground">(requiere {{ e.scope }})</span>
                  <span v-if="e.description" class="block text-xs text-muted-foreground">{{ e.description }}</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div v-if="sensitiveScopes.length" class="space-y-2">
          <span class="text-sm font-medium text-foreground">Datos sensibles</span>
          <p class="text-xs text-muted-foreground">Sin estos permisos los eventos se envían con los datos sensibles omitidos o enmascarados.</p>
          <div class="border border-card-line rounded-card px-4 py-2">
            <template v-for="g in sensitiveScopes" :key="g.group">
              <label v-for="s in g.items" :key="s.key" class="flex items-start gap-2 py-1">
                <input
                  type="checkbox" :class="[checkClass, 'mt-0.5']"
                  :checked="form.scopes.includes(s.key)"
                  @change="form.scopes = toggleValue(form.scopes, s.key, ($event.target as HTMLInputElement).checked)"
                />
                <span class="text-sm">
                  <code class="text-xs font-mono text-foreground">{{ s.key }}</code>
                  <span v-if="s.description" class="block text-xs text-muted-foreground">{{ s.description }}</span>
                </span>
              </label>
            </template>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <App.Button text="Cancelar" size="sm" @click="showForm = false" />
          <App.Button :text="editing ? 'Guardar' : 'Crear webhook'" severity="primary" size="sm" :disabled="!canSubmit" :loading="saving" @click="submitForm" />
        </div>
      </template>
    </Modal>

    <!-- Secret (once) -->
    <Modal v-model="showSecret" :title="secret?.title ?? ''" size="lg" show-footer :backdrop-dismiss="false">
      <div v-if="secret" class="space-y-3">
        <div class="flex items-start gap-2 rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <IconAlertTriangle class="size-5 shrink-0 text-amber-500" :stroke-width="1.75" />
          <span>Copia el secreto de firma ahora: <strong>no se volverá a mostrar</strong>.</span>
        </div>
        <div class="flex items-center gap-2 rounded-control border border-card-line bg-muted/30 px-3 py-2">
          <code class="flex-1 break-all text-sm font-mono text-foreground">{{ secret.value }}</code>
          <CopyButton :value="secret.value" />
        </div>
        <p v-if="secret.note" class="text-xs text-muted-foreground">{{ secret.note }}</p>
        <p class="text-xs text-muted-foreground">
          Verifica cada entrega con los headers <code class="font-mono">webhook-id</code>, <code class="font-mono">webhook-timestamp</code> y
          <code class="font-mono">webhook-signature</code> (HMAC-SHA256 de <code class="font-mono">id.timestamp.body</code>).
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <App.Button text="Ya lo copié" severity="primary" size="sm" @click="secret = null" />
        </div>
      </template>
    </Modal>

    <!-- Detail -->
    <Modal v-model="showDetail" title="Webhook" size="4xl" variant="drawer-right">
      <div v-if="detail" class="space-y-5">
        <div class="space-y-1">
          <p class="font-mono text-sm text-foreground break-all">{{ detail.url }}</p>
          <p v-if="detail.description" class="text-sm text-muted-foreground">{{ detail.description }}</p>
          <App.Tag :text="webhookState(detail).label" :severity="webhookState(detail).severity" size="xs" />
        </div>

        <div v-if="detail.disabled_at" class="rounded-card border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          Desactivado {{ relativeTime(detail.disabled_at) }}<template v-if="detail.disabled_reason">: {{ detail.disabled_reason }}</template>.
          Corrige el receptor y vuelve a activarlo.
        </div>

        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div class="col-span-2">
            <dt class="text-xs text-muted-foreground mb-1">Eventos</dt>
            <dd class="flex flex-wrap gap-1"><code v-for="e in detail.events" :key="e" class="text-xs font-mono rounded bg-muted px-1.5 py-0.5">{{ e }}</code></dd>
          </div>
          <div v-if="detail.organization_id"><dt class="text-xs text-muted-foreground">Sede</dt><dd>{{ orgLabel(detail.organization_id) }}</dd></div>
          <div v-if="detail.scopes?.length"><dt class="text-xs text-muted-foreground">Datos sensibles</dt><dd class="font-mono text-xs">{{ detail.scopes.join(', ') }}</dd></div>
          <div><dt class="text-xs text-muted-foreground">Secreto</dt><dd class="font-mono text-xs">{{ detail.secret_hint || '—' }}</dd></div>
          <div v-if="detail.previous_secret_expires_at"><dt class="text-xs text-muted-foreground">Secreto anterior</dt><dd>Vigente hasta {{ formatDateTime(detail.previous_secret_expires_at) }}</dd></div>
          <div><dt class="text-xs text-muted-foreground">Última entrega OK</dt><dd>{{ formatDateTime(detail.last_success_at) }}</dd></div>
          <div><dt class="text-xs text-muted-foreground">Última falla</dt><dd>{{ formatDateTime(detail.last_failure_at) }}</dd></div>
        </dl>

        <p v-if="detail.legacy" class="text-xs text-muted-foreground">
          Webhook antiguo: se entrega con el formato heredado. Rota el secreto para pasar al formato Standard Webhooks.
        </p>

        <div v-if="canManage" class="flex flex-wrap gap-2">
          <App.Button text="Editar" size="xs" :icon="IconPencil" @click="openEdit(detail)" />
          <App.Button text="Enviar evento de prueba" size="xs" :icon="IconSend" :disabled="!detail.active" :loading="wh.test.isPending.value" @click="doTest(detail)" />
          <App.Button text="Rotar secreto" size="xs" :icon="IconRefresh" @click="doRotate(detail)" />
          <App.Button v-if="detail.active" text="Pausar" size="xs" :icon="IconPlayerPause" @click="setActive(detail, false)" />
          <App.Button v-else text="Activar" size="xs" :icon="IconPlayerPlay" @click="setActive(detail, true)" />
          <App.Button text="Eliminar" size="xs" severity="danger" outline :icon="IconTrash" @click="doDelete(detail)" />
        </div>

        <div>
          <div class="flex items-center gap-2 mb-2">
            <p class="flex-1 text-sm font-semibold text-foreground">Entregas (30 días)</p>
            <select v-model="logs.status" class="h-8 rounded-control border border-card-line bg-card text-xs px-2" @change="reloadLogs">
              <option value="">Todas</option>
              <option value="delivered">Entregadas</option>
              <option value="retrying">Reintentando</option>
              <option value="failed">Fallidas</option>
              <option value="pending">Pendientes</option>
            </select>
          </div>
          <div class="border border-card-line rounded-card overflow-hidden">
            <div v-if="logs.loaded && !logs.items.length" class="p-6 text-center text-sm text-muted-foreground">Sin entregas registradas.</div>
            <ul v-else class="divide-y divide-card-line">
              <li v-for="l in logs.items" :key="l.id" class="text-sm">
                <div class="flex flex-wrap items-center gap-2 px-3 py-2">
                  <button type="button" class="flex-1 min-w-0 text-left flex flex-wrap items-center gap-2" @click="toggleLog(l)">
                    <App.Tag :text="deliveryStatus(l.status).label" :severity="deliveryStatus(l.status).severity" size="xs" />
                    <code class="text-xs font-mono">{{ l.event_key }}</code>
                    <App.Tag v-if="l.is_test" text="Prueba" size="xs" />
                    <App.Tag v-if="l.response_status" :text="`HTTP ${l.response_status}`" :severity="httpSeverity(l.response_status)" size="xs" />
                    <span class="text-xs text-muted-foreground">{{ formatDateTime(l.created_at) }} · intento {{ l.attempts ?? 1 }}<template v-if="l.duration_ms != null"> · {{ l.duration_ms }} ms</template></span>
                    <span v-if="l.status === 'retrying' && l.next_retry_at" class="text-xs text-muted-foreground">· próximo {{ relativeTime(l.next_retry_at) }}</span>
                  </button>
                  <App.Button v-if="canManage && l.status !== 'pending'" text="Reenviar" size="xs" :icon="IconRefresh" @click="doResend(l)" />
                </div>
                <p v-if="l.error && openLog?.id !== l.id" class="px-3 pb-2 text-xs text-destructive break-all">{{ l.error }}</p>
                <div v-if="openLog?.id === l.id" class="px-3 pb-3 space-y-2">
                  <p v-if="openLog.message_id" class="text-xs text-muted-foreground">webhook-id: <code class="font-mono">{{ openLog.message_id }}</code></p>
                  <p v-if="openLog.error" class="text-xs text-destructive break-all">{{ openLog.error }}</p>
                  <div v-if="openLog.request_headers">
                    <p class="text-xs font-medium text-muted-foreground">Headers enviados</p>
                    <pre class="text-xs bg-muted/40 rounded p-2 overflow-auto max-h-40">{{ prettyJson(openLog.request_headers) }}</pre>
                  </div>
                  <div>
                    <p class="text-xs font-medium text-muted-foreground">Payload</p>
                    <pre class="text-xs bg-muted/40 rounded p-2 overflow-auto max-h-64">{{ prettyJson(openLog.payload) }}</pre>
                  </div>
                  <div v-if="openLog.response_body">
                    <p class="text-xs font-medium text-muted-foreground">Respuesta (truncada a 64 KB)</p>
                    <pre class="text-xs bg-muted/40 rounded p-2 overflow-auto max-h-40">{{ prettyJson(openLog.response_body) }}</pre>
                  </div>
                </div>
              </li>
            </ul>
          </div>
          <div class="mt-2 flex justify-center">
            <App.Button v-if="logs.cursor" text="Cargar más" size="xs" :loading="logs.loading" @click="loadMore" />
            <span v-else-if="logs.loading" class="text-xs text-muted-foreground">Cargando…</span>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>
