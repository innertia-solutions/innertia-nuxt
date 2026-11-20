<script setup lang="ts">
import { IconCurrencyDollar, IconDeviceFloppy } from '@tabler/icons-vue'
import { PRICE_FIELDS, parsePrice, formatUsd, type AiModelPrice, type PriceField } from '../../composables/useAiUsage/internal/aiUsage'

/*
 * Ai.ModelPrices — USD prices per model (input/output per 1M tokens, audio per minute, TTS per 1M chars).
 * The cost of every AI usage is computed with the price in force when it is recorded (not retroactive).
 * Backend: \Innertia\Ai\Routes::platform() + platformWrite() (owner).
 *
 *   <Ai.ModelPrices endpoint="platform/ai" :can-edit="isOwner" />
 */
const props = withDefaults(defineProps<{ endpoint?: string; canEdit?: boolean }>(), { endpoint: 'platform/ai', canEdit: true })

const toast = useToast()
const { list, update } = useAiModelPrices({ base: props.endpoint })
const models = computed<AiModelPrice[]>(() => (list.data.value as AiModelPrice[] | undefined) ?? [])

const drafts = reactive<Record<string, Record<PriceField, string>>>({})
const saving = ref<string | null>(null)

function draftOf(m: AiModelPrice) {
  if (!drafts[m.id]) {
    drafts[m.id] = Object.fromEntries(PRICE_FIELDS.map(f => [f.key, m.prices[f.key] === null || m.prices[f.key] === undefined ? '' : String(m.prices[f.key])])) as Record<PriceField, string>
  }
  return drafts[m.id]
}

function dirty(m: AiModelPrice) {
  const d = draftOf(m)
  return PRICE_FIELDS.some(f => parsePrice(d[f.key]) !== (m.prices[f.key] ?? null))
}

async function save(m: AiModelPrice) {
  const d = draftOf(m)
  const prices = {} as Record<PriceField, number | null>
  for (const f of PRICE_FIELDS) {
    const v = parsePrice(d[f.key])
    if (v === undefined) { toast.error(`Precio inválido en ${f.label}.`); return }
    prices[f.key] = v
  }
  saving.value = m.id
  try {
    await update.mutateAsync({ id: m.id, prices })
    delete drafts[m.id]
    toast.success(`Precios de ${m.name} guardados. Rigen para el consumo desde ahora.`)
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'No se pudieron guardar los precios.')
  } finally {
    saving.value = null
  }
}

const inputClass = 'w-24 h-8 rounded-control border border-card-line bg-card text-sm text-foreground px-2 text-right focus:outline-hidden focus:ring-2 focus:ring-primary/30 disabled:opacity-60'
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm text-muted-foreground">
      Precios en dólares de cada modelo. El costo de cada uso de IA se calcula al registrarlo con el precio vigente; un modelo sin precio queda como "sin valorizar".
    </p>

    <div class="bg-card border border-card-line rounded-card overflow-x-auto">
      <div v-if="list.isPending.value" class="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="list.isError.value" class="p-8 text-center text-sm text-muted-foreground">
        No se pudieron cargar los modelos.
        <button type="button" class="text-primary hover:underline" @click="list.refetch()">Reintentar</button>
      </div>
      <div v-else-if="!models.length" class="p-8 text-center text-sm text-muted-foreground">
        <IconCurrencyDollar class="size-6 mx-auto mb-2" :stroke-width="1.5" />
        No hay modelos configurados.
      </div>
      <table v-else class="w-full text-sm">
        <thead class="text-xs uppercase text-muted-foreground">
          <tr class="border-b border-card-line">
            <th class="text-left font-medium px-4 py-2">Modelo</th>
            <th v-for="f in PRICE_FIELDS" :key="f.key" class="text-right font-medium px-2 py-2" :title="f.hint">
              {{ f.label }}<span class="block normal-case font-normal">{{ f.hint }}</span>
            </th>
            <th class="px-4 py-2" />
          </tr>
        </thead>
        <tbody class="divide-y divide-card-line">
          <tr v-for="m in models" :key="m.id">
            <td class="px-4 py-2">
              <p class="font-medium text-foreground flex items-center gap-2">
                {{ m.name }}
                <App.Tag v-if="!m.priced" text="Sin precio" severity="warning" size="xs" />
                <App.Tag v-if="!m.active" text="Inactivo" size="xs" />
              </p>
              <p class="text-xs text-muted-foreground font-mono">{{ m.provider?.name ?? '—' }} · {{ m.key }}</p>
            </td>
            <td v-for="f in PRICE_FIELDS" :key="f.key" class="px-2 py-2 text-right">
              <input v-if="canEdit" v-model="draftOf(m)[f.key]" type="text" inputmode="decimal" placeholder="—" :class="inputClass" :aria-label="`${f.label} ${m.name}`" />
              <span v-else class="text-foreground">{{ m.prices[f.key] === null ? '—' : formatUsd(m.prices[f.key]) }}</span>
            </td>
            <td class="px-4 py-2 text-right">
              <App.Button v-if="canEdit" text="Guardar" size="xs" severity="primary" :icon="IconDeviceFloppy"
                :disabled="!dirty(m)" :loading="saving === m.id" @click="save(m)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
