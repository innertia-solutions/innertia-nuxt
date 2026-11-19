# Integraciones: API keys, webhooks y documentación de la API

Pantallas listas para montar en el producto sobre el motor de **innertia-laravel**
(`\Innertia\PublicApi`, `\Innertia\ApiKeys`, `\Innertia\Webhooks`). Ver también
`docs/webhooks-api.md` de innertia-laravel (eventos, scopes, descriptores y firma).

## Backend requerido

```php
// routes/api.private.php — gestión desde el backoffice (solo admins)
Route::middleware(['auth:api', 'tenant.require', 'permission:settings.manage'])
    ->prefix('integrations')
    ->group(fn () => \Innertia\PublicApi\Routes::manage());

// routes/api.php — especificación pública
\Innertia\PublicApi\Routes::docs();   // GET v1/openapi.json
```

`Routes::manage()` expone `api-keys` (lista, scopes, crear, rotar, revocar, registro de uso) y
`webhooks` (lista, catálogo de eventos, crear/editar/eliminar, rotar secreto, evento de prueba,
entregas, reenviar). Si se monta con otro prefijo, pásalo en la prop `endpoint`.

## Componentes

### `<Integrations.ApiKeys>`

Lista de claves del espacio, alta con permisos (scopes agrupados por recurso), sede opcional y
vencimiento; la clave (`pk_live_…`) se muestra **una sola vez** con botón copiar. Detalle con el
registro de uso (30 días, "Cargar más" por cursor), **Rotar** (la clave anterior convive 24 h) y
**Revocar** (inmediato).

### `<Integrations.Webhooks>`

Lista de suscripciones con estado (activo, pausado, con fallas, desactivado por fallas + motivo),
alta/edición con URL https, eventos (familias `call.*` o eventos sueltos), sede opcional y
permisos de datos sensibles (`people:pii`, `recordings:read`, … según los scopes que declaran los
eventos). El secreto `whsec_…` se muestra **una sola vez**. Detalle con entregas (filtro por estado,
payload, headers enviados, respuesta truncada a 64 KB), **Reenviar**, **Enviar evento de prueba**,
**Rotar secreto** (24 h firmando con ambos), **Pausar/Activar** y **Eliminar**.

Props comunes de ambos:

| Prop | Tipo | Default | Uso |
|---|---|---|---|
| `endpoint` | `string` | `'integrations'` | Prefijo donde el producto montó `Routes::manage()` |
| `organizations` | `{ value, label }[]` | `[]` | Sedes para limitar la clave/suscripción; si está vacío no se muestra el selector |
| `canManage` | `boolean` | `true` | `false` oculta crear/rotar/revocar/probar/reenviar (solo lectura) |
| `developersUrl` | `string` | `''` | Enlace "Documentación de la API" |

### `<Integrations.Developers>`

Referencia interactiva de la API (OpenAPI 3.1 con endpoints y eventos de webhook) con Scalar,
cargado en el cliente desde `cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.4` (versión fija).

| Prop | Tipo | Uso |
|---|---|---|
| `specUrl` | `string` (requerida) | URL de `v1/openapi.json` del backend |

## Ejemplo (pomely, Sistema › Integraciones)

```vue
<script setup lang="ts">
const tab = ref<'keys' | 'webhooks' | 'connectors'>('keys')
const { can } = usePermissions()
const sites = computed(() => organizations.value.map(o => ({ value: o.id, label: o.name })))
</script>

<template>
  <App.SegmentedControl v-model="tab" :options="[...]" />
  <Integrations.ApiKeys v-if="tab === 'keys'" :organizations="sites" :can-manage="can('settings.manage')" developers-url="/developers" />
  <Integrations.Webhooks v-else-if="tab === 'webhooks'" :organizations="sites" :can-manage="can('settings.manage')" developers-url="/developers" />
</template>
```

```vue
<!-- pages/developers.vue (pública) -->
<template>
  <Integrations.Developers :spec-url="`${useRuntimeConfig().public.apiBase}/v1/openapi.json`" />
</template>
```

## Composables

`useApiKeys({ base })` → `{ list, scopes, create, rotate, revoke, requests(id, cursor) }` y
`useWebhooks({ base })` → `{ list, events, create, update, remove, rotateSecret, test, resend,
logs(id, { cursor, status }), log(id, logId) }` (vue-query). Los helpers puros (estados, comodines
de eventos, validación de URL, fechas) viven en `composables/useIntegrations/internal` y no se
auto-importan.
