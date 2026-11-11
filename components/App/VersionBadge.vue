<script setup>
/**
 * <AppVersionBadge /> — versión desplegada del front, visible en shells y login.
 * Lee /_version (público). Muestra "v1.0.2 · QA #7"; tooltip con versión completa,
 * commit y fecha de build. Con `to`, enlaza al detalle (p. ej. la página con <AppVersions />).
 *
 * ```vue
 * <AppVersionBadge />
 * <AppVersionBadge to="/platform" />
 * ```
 */
import { NuxtLink } from '#components'
import { parseVersion, versionLabel } from '../../utils/version-string'

const props = defineProps({
  endpoint: { type: String, default: '/_version' },
  to:       { type: String, default: '' },
})

const { data } = useFetch(props.endpoint, { server: false, key: `innertia-version-badge:${props.endpoint}` })

const parts = computed(() => parseVersion(data.value?.version))
const label = computed(() => versionLabel(data.value?.version))
const title = computed(() => {
  const d = data.value
  if (!d) return ''
  const date = d.build_date ? new Date(d.build_date) : null
  return [
    d.version,
    d.commit ? `commit ${d.commit}` : null,
    date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : null,
  ].filter(Boolean).join(' · ')
})
const tone = computed(() => parts.value?.environment === 'qa'
  ? 'text-amber-600 dark:text-amber-400'
  : 'text-muted-foreground')
</script>

<template>
  <component
    :is="to ? NuxtLink : 'span'"
    v-if="label"
    :to="to || undefined"
    :title="title"
    class="inline-flex items-center font-mono text-[11px] leading-none hover:text-foreground"
    :class="tone"
  >
    {{ label }}
  </component>
</template>
