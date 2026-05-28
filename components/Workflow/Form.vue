<script setup>
import { ref, computed } from 'vue'
import {
  IconPlus, IconTrash, IconChevronDown, IconChevronUp,
  IconGripVertical, IconArrowRight, IconAlertTriangle,
} from '@tabler/icons-vue'

/**
 * WorkflowForm — editor estructurado de WorkflowDefinition.
 * Alternativa al canvas Builder.vue para flujos lineales o usuarios no técnicos.
 *
 * Usa useWorkflowForm internamente o acepta modelValue externo.
 */

const props = defineProps({
  /** Definición inicial { steps:[], transitions:[] } */
  modelValue: { type: Object, default: null },
  /** Solo lectura */
  readonly:   { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

// ── Composable de edición ─────────────────────────────────────────────────────
const {
  definition, isDirty, isValid,
  addStep, updateStep, deleteStep, reorderSteps,
  addTransition, updateTransition, deleteTransition,
  addRestriction, removeRestriction,
  transitionsFrom,
} = useWorkflowForm(props.modelValue)

// Sync hacia arriba
watch(definition, (val) => emit('update:modelValue', val), { deep: true })

// Sync desde arriba (si el parent cambia modelValue externamente)
watch(() => props.modelValue, (val) => {
  if (val && JSON.stringify(val) !== JSON.stringify(definition.value)) {
    definition.value = JSON.parse(JSON.stringify(val))
  }
}, { deep: true })

// ── Constantes de tipos ───────────────────────────────────────────────────────

const STEP_TYPES = [
  { value: 'start',          label: 'Inicio',        color: 'emerald', description: 'Punto de entrada — solo uno permitido' },
  { value: 'in_progress',    label: 'En progreso',   color: 'blue',    description: 'Paso activo del proceso' },
  { value: 'pause_internal', label: 'Pausa interna', color: 'amber',   description: 'Pausado por el sistema' },
  { value: 'pause_external', label: 'Pausa externa', color: 'orange',  description: 'Esperando acción externa' },
  { value: 'finished',       label: 'Finalizado',    color: 'violet',  description: 'Estado terminal exitoso' },
  { value: 'cancelled',      label: 'Cancelado',     color: 'red',     description: 'Estado terminal cancelado' },
]

const RESTRICTION_TYPES = [
  { value: 'role',            label: 'Rol',                   fields: ['roles']      },
  { value: 'required_fields', label: 'Campos requeridos',     fields: ['fields']     },
  { value: 'approval',        label: 'Aprobación',            fields: ['role']       },
  { value: 'checklist',       label: 'Checklist completo',    fields: ['checklist']  },
  { value: 'document',        label: 'Documento requerido',   fields: ['document']   },
  { value: 'min_items',       label: 'Mínimo de ítems',       fields: ['relation', 'min'] },
  { value: 'date',            label: 'Fecha mínima',          fields: ['after']      },
  { value: 'custom',          label: 'Personalizado',         fields: ['entity', 'field', 'value'] },
]

const stepTypeColor = (type) => STEP_TYPES.find(t => t.value === type)?.color ?? 'slate'
const stepTypeLabel = (type) => STEP_TYPES.find(t => t.value === type)?.label ?? type

// ── Steps: nuevo step ─────────────────────────────────────────────────────────

const showNewStep  = ref(false)
const newStep      = ref({ key: '', label: '', type: 'in_progress', description: '' })
const newStepError = ref('')

const submitNewStep = () => {
  newStepError.value = ''
  try {
    addStep({ ...newStep.value })
    newStep.value  = { key: '', label: '', type: 'in_progress', description: '' }
    showNewStep.value = false
  } catch (e) {
    newStepError.value = e.message
  }
}

// ── Steps: edición inline ─────────────────────────────────────────────────────

const editingStep = ref(null)  // key del step en edición
const stepDraft   = ref({})

const startEditStep = (step) => {
  editingStep.value = step.key
  stepDraft.value   = { ...step }
}

const saveStep = () => {
  try {
    updateStep(editingStep.value, stepDraft.value)
    editingStep.value = null
  } catch (e) {}
}

const cancelEditStep = () => { editingStep.value = null }

// ── Steps: reorder (drag handle simple con botones up/down) ──────────────────

const moveStepUp   = (idx) => { if (idx > 0) reorderSteps(idx, idx - 1) }
const moveStepDown = (idx) => { if (idx < definition.value.steps.length - 1) reorderSteps(idx, idx + 1) }

// ── Transiciones: panel expandible por step ──────────────────────────────────

const expandedStepKey = ref(null)
const toggleStep = (key) => {
  expandedStepKey.value = expandedStepKey.value === key ? null : key
}

// ── Transiciones: nuevo ───────────────────────────────────────────────────────

const showingAddTransition = ref(null)  // step.key que está mostrando el form
const newTransition = ref({ to: '', label: '', description: '' })
const newTransitionError = ref('')

const openAddTransition = (fromKey) => {
  showingAddTransition.value = fromKey
  newTransition.value = { to: '', label: '', description: '' }
  newTransitionError.value = ''
}

const submitTransition = (fromKey) => {
  newTransitionError.value = ''
  try {
    addTransition({
      from:         fromKey,
      to:           newTransition.value.to,
      label:        newTransition.value.label,
      description:  newTransition.value.description,
      restrictions: [],
    })
    showingAddTransition.value = null
  } catch (e) {
    newTransitionError.value = e.message
  }
}

// ── Restricciones ─────────────────────────────────────────────────────────────

const expandedTransition = ref(null)  // `${from}__${to}`
const toggleTransition = (from, to) => {
  const key = `${from}__${to}`
  expandedTransition.value = expandedTransition.value === key ? null : key
}

const isTransitionExpanded = (from, to) => expandedTransition.value === `${from}__${to}`

const addRestrictionTo = (from, to) => {
  addRestriction(from, to, { type: 'role', roles: [], message: '' })
}

// ── Validaciones visuales ────────────────────────────────────────────────────

const warnings = computed(() => {
  const w = []
  const steps = definition.value.steps ?? []
  const transitions = definition.value.transitions ?? []

  if (!steps.some(s => s.type === 'start'))
    w.push('Falta un step de tipo Inicio')
  if (!steps.some(s => ['finished', 'cancelled'].includes(s.type)))
    w.push('Falta al menos un step terminal (Finalizado o Cancelado)')

  const startSteps = steps.filter(s => s.type === 'start')
  if (startSteps.length > 1)
    w.push('Solo puede haber un step de tipo Inicio')

  // Steps sin transiciones salientes (excepto terminales)
  for (const step of steps) {
    if (['finished', 'cancelled'].includes(step.type)) continue
    if (!transitions.some(t => t.from === step.key))
      w.push(`Step "${step.label}" no tiene transiciones salientes`)
  }

  return w
})

// ── Computed para el selector de destino ─────────────────────────────────────

const availableTargets = (fromKey) =>
  definition.value.steps.filter(s => {
    if (s.key === fromKey) return false
    // No ofrecer si ya existe esa transición
    return !definition.value.transitions.some(t => t.from === fromKey && t.to === s.key)
  })
</script>

<template>
  <div class="flex flex-col gap-4">

    <!-- ── Warnings de validación ─────────────────────────────────────────── -->
    <div v-if="warnings.length" class="rounded-card border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-1">
      <div v-for="w in warnings" :key="w" class="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
        <IconAlertTriangle :size="13" class="shrink-0 mt-0.5" />
        {{ w }}
      </div>
    </div>

    <!-- ── STEPS ──────────────────────────────────────────────────────────── -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-foreground">Steps</h3>
        <button
          v-if="!readonly"
          type="button"
          @click="showNewStep = !showNewStep"
          class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <IconPlus :size="13" /> Agregar step
        </button>
      </div>

      <!-- Form nuevo step -->
      <Transition
        enter-active-class="transition-all duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showNewStep" class="rounded-card border border-primary/30 bg-primary/5 p-3 space-y-3">
          <p class="text-xs font-medium text-foreground">Nuevo step</p>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[11px] text-muted-foreground">Clave</label>
              <input
                v-model="newStep.key"
                placeholder="ej. revision"
                @keydown.enter="submitNewStep"
                class="w-full h-7 px-2 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] text-muted-foreground">Label</label>
              <input
                v-model="newStep.label"
                placeholder="ej. Revisión"
                @keydown.enter="submitNewStep"
                class="w-full h-7 px-2 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] text-muted-foreground">Tipo</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <button
                v-for="t in STEP_TYPES"
                :key="t.value"
                type="button"
                @click="newStep.type = t.value"
                :class="[
                  'flex items-center gap-1.5 px-2 py-1.5 rounded-control border text-xs transition-colors text-left',
                  newStep.type === t.value
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-card-line text-muted-foreground hover:border-primary/50',
                ]"
              >
                <span :class="[
                  'w-2 h-2 rounded-full shrink-0',
                  t.color === 'emerald' ? 'bg-emerald-500' : t.color === 'blue' ? 'bg-blue-500' :
                  t.color === 'amber'   ? 'bg-amber-500'   : t.color === 'orange' ? 'bg-orange-500' :
                  t.color === 'violet'  ? 'bg-violet-500'  : 'bg-red-500'
                ]" />
                {{ t.label }}
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] text-muted-foreground">Descripción (opcional)</label>
            <input
              v-model="newStep.description"
              placeholder="Describe qué sucede en este step"
              class="w-full h-7 px-2 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <p v-if="newStepError" class="text-xs text-red-500">{{ newStepError }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" @click="showNewStep = false" class="px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded-control transition-colors">Cancelar</button>
            <button type="button" @click="submitNewStep" :disabled="!newStep.key || !newStep.label" class="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary-hover rounded-control transition-colors disabled:opacity-50">Agregar</button>
          </div>
        </div>
      </Transition>

      <!-- Lista de steps -->
      <div class="rounded-card border border-card-line overflow-hidden divide-y divide-card-line">

        <div v-if="!definition.steps.length" class="px-4 py-6 text-center text-sm text-muted-foreground italic">
          No hay steps. Agrega el primero.
        </div>

        <div
          v-for="(step, idx) in definition.steps"
          :key="step.key"
          class="bg-card"
        >
          <!-- Step row -->
          <div class="flex items-center gap-2 px-3 py-2.5">

            <!-- Reorder buttons -->
            <div v-if="!readonly" class="flex flex-col gap-0.5 shrink-0">
              <button type="button" @click="moveStepUp(idx)" :disabled="idx === 0" class="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                <IconChevronUp :size="12" />
              </button>
              <button type="button" @click="moveStepDown(idx)" :disabled="idx === definition.steps.length - 1" class="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                <IconChevronDown :size="12" />
              </button>
            </div>

            <!-- Type dot -->
            <span :class="[
              'w-2.5 h-2.5 rounded-full shrink-0',
              stepTypeColor(step.type) === 'emerald' ? 'bg-emerald-500' :
              stepTypeColor(step.type) === 'blue'    ? 'bg-blue-500'    :
              stepTypeColor(step.type) === 'amber'   ? 'bg-amber-500'   :
              stepTypeColor(step.type) === 'orange'  ? 'bg-orange-500'  :
              stepTypeColor(step.type) === 'violet'  ? 'bg-violet-500'  :
              stepTypeColor(step.type) === 'red'     ? 'bg-red-500'     : 'bg-slate-400'
            ]" />

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <template v-if="editingStep === step.key">
                <div class="flex items-center gap-2">
                  <input v-model="stepDraft.label" @keydown.enter="saveStep" @keydown.escape="cancelEditStep" class="flex-1 h-7 px-2 text-xs rounded-control border border-primary bg-card text-foreground focus:outline-none" />
                  <input v-model="stepDraft.key"   @keydown.enter="saveStep" @keydown.escape="cancelEditStep" class="w-28 h-7 px-2 text-xs font-mono rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary" />
                  <select v-model="stepDraft.type" class="h-7 px-2 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary">
                    <option v-for="t in STEP_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                  </select>
                  <button type="button" @click="saveStep" class="text-xs font-medium text-primary hover:underline shrink-0">OK</button>
                  <button type="button" @click="cancelEditStep" class="text-xs text-muted-foreground hover:underline shrink-0">×</button>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-foreground truncate">{{ step.label }}</span>
                  <span class="text-xs font-mono text-muted-foreground hidden sm:inline">{{ step.key }}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded-badge bg-muted text-muted-foreground shrink-0">{{ stepTypeLabel(step.type) }}</span>
                </div>
                <p v-if="step.description" class="text-xs text-muted-foreground truncate mt-0.5">{{ step.description }}</p>
              </template>
            </div>

            <!-- Transiciones badge -->
            <button
              type="button"
              @click="toggleStep(step.key)"
              class="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-control hover:bg-muted"
            >
              <IconArrowRight :size="12" />
              <span class="tabular-nums">{{ transitionsFrom(step.key).length }}</span>
              <IconChevronDown :size="12" :class="['transition-transform', expandedStepKey === step.key ? 'rotate-180' : '']" />
            </button>

            <!-- Edit / Delete -->
            <template v-if="!readonly">
              <button v-if="editingStep !== step.key" type="button" @click="startEditStep(step)" class="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors p-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
                  <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.76 9.768a1.75 1.75 0 0 0-.455.88l-.5 2.5a.75.75 0 0 0 .875.876l2.5-.5a1.75 1.75 0 0 0 .88-.455l7.255-7.254a1.75 1.75 0 0 0 0-2.474Z" />
                </svg>
              </button>
              <button type="button" @click="deleteStep(step.key)" class="shrink-0 text-red-400 hover:text-red-600 transition-colors p-1">
                <IconTrash :size="14" />
              </button>
            </template>
          </div>

          <!-- Panel de transiciones del step (expandible) -->
          <Transition
            enter-active-class="transition-all duration-150 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-all duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="expandedStepKey === step.key" class="border-t border-card-line bg-surface px-3 py-3 space-y-2">

              <!-- Lista de transiciones -->
              <div
                v-for="t in transitionsFrom(step.key)"
                :key="t.to"
                class="rounded-control border border-card-line bg-card overflow-hidden"
              >
                <!-- Transition row -->
                <div class="flex items-center gap-2 px-3 py-2">
                  <IconArrowRight :size="13" class="text-muted-foreground-2 shrink-0" />
                  <div class="flex-1 min-w-0">
                    <span class="text-xs font-medium text-foreground">
                      {{ definition.steps.find(s => s.key === t.to)?.label ?? t.to }}
                    </span>
                    <span v-if="t.label" class="text-xs text-muted-foreground ml-1.5 italic">— {{ t.label }}</span>
                  </div>
                  <button
                    type="button"
                    @click="toggleTransition(step.key, t.to)"
                    class="shrink-0 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                  >
                    <span v-if="t.restrictions?.length" class="font-medium">{{ t.restrictions.length }} restricción{{ t.restrictions.length !== 1 ? 'es' : '' }}</span>
                    <span v-else class="italic">sin restricciones</span>
                    <IconChevronDown :size="11" :class="['transition-transform', isTransitionExpanded(step.key, t.to) ? 'rotate-180' : '']" />
                  </button>
                  <button v-if="!readonly" type="button" @click="deleteTransition(step.key, t.to)" class="shrink-0 text-red-400 hover:text-red-600 transition-colors p-1">
                    <IconTrash :size="12" />
                  </button>
                </div>

                <!-- Restrictions panel -->
                <div v-if="isTransitionExpanded(step.key, t.to)" class="border-t border-card-line bg-surface px-3 py-2.5 space-y-2">

                  <div
                    v-for="(r, ridx) in (t.restrictions ?? [])"
                    :key="ridx"
                    class="rounded border border-card-line bg-card p-2 space-y-1.5"
                  >
                    <div class="flex items-center gap-2">
                      <select
                        v-model="r.type"
                        :disabled="readonly"
                        @change="updateTransition(step.key, t.to, { restrictions: t.restrictions })"
                        class="flex-1 h-6 px-1.5 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                      >
                        <option v-for="rt in RESTRICTION_TYPES" :key="rt.value" :value="rt.value">{{ rt.label }}</option>
                      </select>
                      <button v-if="!readonly" type="button" @click="removeRestriction(step.key, t.to, ridx)" class="text-red-400 hover:text-red-600 transition-colors shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg>
                      </button>
                    </div>
                    <input
                      v-model="r.message"
                      :disabled="readonly"
                      placeholder="Mensaje de error al usuario…"
                      @blur="updateTransition(step.key, t.to, { restrictions: t.restrictions })"
                      class="w-full h-6 px-1.5 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                    />
                    <!-- Campos específicos por tipo -->
                    <input v-if="r.type === 'role'"            v-model="r.roles"     :disabled="readonly" placeholder="admin, manager" @blur="updateTransition(step.key, t.to, { restrictions: t.restrictions })" class="w-full h-6 px-1.5 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
                    <input v-if="r.type === 'required_fields'" v-model="r.fields"    :disabled="readonly" placeholder="campo1, campo2" @blur="updateTransition(step.key, t.to, { restrictions: t.restrictions })" class="w-full h-6 px-1.5 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
                    <input v-if="r.type === 'checklist'"       v-model="r.checklist" :disabled="readonly" placeholder="nombre del checklist" @blur="updateTransition(step.key, t.to, { restrictions: t.restrictions })" class="w-full h-6 px-1.5 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
                    <input v-if="r.type === 'document'"        v-model="r.document"  :disabled="readonly" placeholder="nombre del documento" @blur="updateTransition(step.key, t.to, { restrictions: t.restrictions })" class="w-full h-6 px-1.5 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
                    <input v-if="r.type === 'approval'"        v-model="r.role"      :disabled="readonly" placeholder="rol que debe aprobar" @blur="updateTransition(step.key, t.to, { restrictions: t.restrictions })" class="w-full h-6 px-1.5 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
                    <div v-if="r.type === 'min_items'" class="flex gap-1.5">
                      <input v-model="r.relation" :disabled="readonly" placeholder="relación (ej. attachments)" @blur="updateTransition(step.key, t.to, { restrictions: t.restrictions })" class="flex-1 h-6 px-1.5 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
                      <input v-model.number="r.min" :disabled="readonly" type="number" placeholder="min" @blur="updateTransition(step.key, t.to, { restrictions: t.restrictions })" class="w-16 h-6 px-1.5 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
                    </div>
                    <input v-if="r.type === 'date'"   v-model="r.after"  :disabled="readonly" type="date" @blur="updateTransition(step.key, t.to, { restrictions: t.restrictions })" class="w-full h-6 px-1.5 text-[11px] rounded border border-card-line bg-card text-foreground focus:outline-none focus:border-primary disabled:opacity-50" />
                  </div>

                  <p v-if="!t.restrictions?.length" class="text-[11px] text-muted-foreground italic">Sin restricciones — cualquier usuario puede transicionar</p>

                  <button
                    v-if="!readonly"
                    type="button"
                    @click="addRestrictionTo(step.key, t.to)"
                    class="text-xs text-primary hover:underline"
                  >
                    + Agregar restricción
                  </button>
                </div>
              </div>

              <!-- Form nueva transición -->
              <div v-if="showingAddTransition === step.key" class="rounded-control border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                <div class="flex items-center gap-2">
                  <select
                    v-model="newTransition.to"
                    class="flex-1 h-7 px-2 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="" disabled>Destino…</option>
                    <option v-for="s in availableTargets(step.key)" :key="s.key" :value="s.key">{{ s.label }}</option>
                  </select>
                  <input
                    v-model="newTransition.label"
                    placeholder="Label (opcional)"
                    class="flex-1 h-7 px-2 text-xs rounded-control border border-card-line bg-card text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <p v-if="newTransitionError" class="text-xs text-red-500">{{ newTransitionError }}</p>
                <div class="flex justify-end gap-2">
                  <button type="button" @click="showingAddTransition = null" class="px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted rounded-control transition-colors">Cancelar</button>
                  <button type="button" @click="submitTransition(step.key)" :disabled="!newTransition.to" class="px-2.5 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary-hover rounded-control transition-colors disabled:opacity-50">Agregar</button>
                </div>
              </div>

              <!-- Botón agregar transición -->
              <button
                v-if="!readonly && showingAddTransition !== step.key && !['finished','cancelled'].includes(step.type)"
                type="button"
                @click="openAddTransition(step.key)"
                class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <IconPlus :size="12" /> Agregar transición
              </button>

              <p v-if="['finished','cancelled'].includes(step.type)" class="text-xs text-muted-foreground italic">
                Los steps terminales no tienen transiciones salientes.
              </p>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- ── Footer con estado ──────────────────────────────────────────────── -->
    <div class="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-card-line">
      <span>{{ definition.steps.length }} steps · {{ definition.transitions.length }} transiciones</span>
      <span
        v-if="isValid"
        class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
          <path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" />
        </svg>
        Definición válida
      </span>
      <span v-if="isDirty && !readonly" class="text-amber-500">· cambios sin guardar</span>
    </div>

  </div>
</template>
