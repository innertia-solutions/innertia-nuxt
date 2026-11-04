<script setup>
/**
 * <AppVersions /> — tarjeta "Versiones" para la consola /platform.
 * Consume /_version/details (ruta Nitro de la capa), que autoriza contra el backend
 * (GET platform/version → solo platform admin) y adjunta el detalle del front.
 *
 * ```vue
 * <AppVersions />
 * <AppVersions endpoint="/_version/details" title="Versiones" />
 * ```
 */
import { IconVersions, IconRefresh } from '@tabler/icons-vue'

const props = defineProps({
  endpoint: { type: String, default: '/_version/details' },
  title:    { type: String, default: 'Versiones' },
})

const { data, error, pending, refresh } = useFetch(props.endpoint, { server: false, key: `innertia-versions:${props.endpoint}` })

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

const sides = computed(() => {
  if (!data.value) return []
  const { frontend: f, backend: b } = data.value
  return [
    {
      key: 'frontend',
      label: 'Frontend',
      info: f,
      runtime: [['Node', f?.runtime?.node]],
      packages: Object.entries(f?.packages ?? {}).map(([name, version]) => ({ name, version })),
    },
    {
      key: 'backend',
      label: 'Backend',
      info: b,
      runtime: [
        ['PHP', b?.runtime?.php],
        ['Laravel', b?.runtime?.laravel],
        [b?.runtime?.database?.driver ? `BD (${b.runtime.database.driver})` : 'BD', b?.runtime?.database?.version],
      ],
      packages: Object.entries(b?.packages ?? {}).map(([name, p]) => ({ name, version: p?.version, reference: p?.reference })),
    },
  ]
})
</script>

<template>
  <section class="rounded-card border border-card-line bg-card">
    <header class="flex items-center justify-between gap-3 border-b border-card-line px-4 py-3">
      <div class="flex items-center gap-2">
        <IconVersions class="size-5 text-muted-foreground" />
        <h2 class="text-sm font-semibold text-foreground">{{ title }}</h2>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        :disabled="pending"
        @click="refresh()"
      >
        <IconRefresh class="size-3.5" :class="{ 'animate-spin': pending }" /> Actualizar
      </button>
    </header>

    <div v-if="pending && !data" class="p-4 text-sm text-muted-foreground">Cargando…</div>
    <div v-else-if="error" class="p-4 text-sm text-red-600 dark:text-red-400">
      No se pudieron cargar las versiones ({{ error.statusCode ?? 'error' }}).
    </div>

    <div v-else class="grid divide-y divide-card-line md:grid-cols-2 md:divide-x md:divide-y-0">
      <div v-for="side in sides" :key="side.key" class="space-y-4 p-4">
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ side.label }}</p>
          <p class="mt-1 text-lg font-semibold text-foreground">
            {{ side.info?.app || '—' }}
            <span class="text-sm font-normal text-muted-foreground">{{ side.info?.version || '' }}</span>
          </p>
        </div>

        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt class="text-muted-foreground">Commit</dt>
          <dd class="flex items-center gap-1 font-mono text-foreground">
            {{ side.info?.commit || '—' }}
            <CopyButton v-if="side.info?.commit" :value="side.info.commit" size="xs" />
          </dd>
          <dt class="text-muted-foreground">Build</dt>
          <dd class="text-foreground">{{ fmtDate(side.info?.build_date) }}</dd>
          <dt class="text-muted-foreground">Entorno</dt>
          <dd class="text-foreground">{{ side.info?.environment || '—' }}</dd>
          <template v-for="[label, value] in side.runtime" :key="label">
            <dt class="text-muted-foreground">{{ label }}</dt>
            <dd class="font-mono text-foreground">{{ value || '—' }}</dd>
          </template>
        </dl>

        <div v-if="side.packages.length">
          <p class="mb-1.5 text-xs font-medium text-muted-foreground">Paquetes</p>
          <ul class="divide-y divide-card-line rounded-control border border-card-line text-sm">
            <li v-for="p in side.packages" :key="p.name" class="flex items-center justify-between gap-3 px-3 py-1.5">
              <span class="truncate text-foreground">{{ p.name }}</span>
              <span class="shrink-0 font-mono text-xs text-muted-foreground">
                {{ p.version || '—' }}<template v-if="p.reference && String(p.version).startsWith('dev-')"> · {{ p.reference }}</template>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
