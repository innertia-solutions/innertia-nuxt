<script setup lang="ts">
/*
 * Integrations.Developers — interactive API reference (OpenAPI 3.1 + webhook events) rendered with
 * Scalar, loaded client-side from the pinned CDN build (jsdelivr, allowlisted).
 * Backend: \Innertia\PublicApi\Routes::docs() serves GET v1/openapi.json.
 *
 *   <Integrations.Developers :spec-url="`${apiBase}/v1/openapi.json`" />
 */
const props = defineProps<{ specUrl: string }>()

const SCALAR_SRC = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.4/dist/browser/standalone.js'

const el = ref<HTMLElement | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
let app: any = null

function loadScript(): Promise<void> {
  const w = window as any
  if (w.Scalar?.createApiReference) return Promise.resolve()
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCALAR_SRC}"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = SCALAR_SRC
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('scalar')), { once: true })
  })
}

async function mount() {
  if (!el.value) return
  state.value = 'loading'
  try {
    await loadScript()
    app?.destroy?.()
    app = (window as any).Scalar.createApiReference(el.value, { url: props.specUrl, hideClientButton: false })
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

onMounted(mount)
watch(() => props.specUrl, mount)
onBeforeUnmount(() => { app?.destroy?.(); app = null })
</script>

<template>
  <div class="relative min-h-[60vh]">
    <div v-if="state === 'loading'" class="p-8 text-center text-sm text-muted-foreground">Cargando documentación…</div>
    <div v-else-if="state === 'error'" class="p-8 text-center text-sm text-muted-foreground">
      No se pudo cargar el visor de la documentación.
      <a :href="specUrl" target="_blank" rel="noopener" class="text-primary hover:underline">Descargar openapi.json</a>
    </div>
    <div ref="el" />
  </div>
</template>
