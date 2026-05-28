import { ref, computed, watch } from 'vue'

/**
 * useWorkflowForm — gestiona el estado de edición de una WorkflowDefinition.
 *
 * Responsabilidad: CRUD de steps y transitions sobre el JSON de configuración.
 * No sabe nada de instancias, vistas ni API calls de runtime.
 *
 * @param {Object|null} initial — definición inicial { steps:[], transitions:[] }
 */
export function useWorkflowForm(initial = null) {
  const definition = ref(
    initial
      ? JSON.parse(JSON.stringify(initial))
      : { steps: [], transitions: [] }
  )

  const isDirty  = ref(false)
  const saving   = ref(false)

  // Track changes — se activa después del primer tick para no marcar dirty en la carga
  let _trackChanges = false
  watch(definition, () => { if (_trackChanges) isDirty.value = true }, { deep: true })
  setTimeout(() => { _trackChanges = true }, 0)

  // ── Steps ──────────────────────────────────────────────────────────────────

  const addStep = (step) => {
    if (!step.key || !step.label || !step.type) throw new Error('Step requiere key, label y type')
    if (definition.value.steps.some(s => s.key === step.key)) throw new Error(`Step '${step.key}' ya existe`)
    definition.value.steps.push({ ...step })
  }

  const updateStep = (key, patch) => {
    const idx = definition.value.steps.findIndex(s => s.key === key)
    if (idx === -1) return
    const newKey = patch.key ?? key
    definition.value.steps[idx] = { ...definition.value.steps[idx], ...patch }
    // Si cambió el key, actualizar todas las transiciones que lo referencian
    if (newKey !== key) {
      definition.value.transitions = definition.value.transitions.map(t => ({
        ...t,
        from: t.from === key ? newKey : t.from,
        to:   t.to   === key ? newKey : t.to,
      }))
    }
  }

  const deleteStep = (key) => {
    definition.value.steps       = definition.value.steps.filter(s => s.key !== key)
    definition.value.transitions = definition.value.transitions.filter(t => t.from !== key && t.to !== key)
  }

  const reorderSteps = (fromIdx, toIdx) => {
    const steps = [...definition.value.steps]
    const [moved] = steps.splice(fromIdx, 1)
    steps.splice(toIdx, 0, moved)
    definition.value.steps = steps
  }

  // ── Transitions ────────────────────────────────────────────────────────────

  const addTransition = (transition) => {
    if (!transition.from || !transition.to) throw new Error('Transition requiere from y to')
    const exists = definition.value.transitions.some(
      t => t.from === transition.from && t.to === transition.to
    )
    if (exists) throw new Error(`Transición ${transition.from} → ${transition.to} ya existe`)
    definition.value.transitions.push({
      from:         transition.from,
      to:           transition.to,
      label:        transition.label ?? '',
      description:  transition.description ?? '',
      restrictions: transition.restrictions ?? [],
    })
  }

  const updateTransition = (from, to, patch) => {
    const idx = definition.value.transitions.findIndex(t => t.from === from && t.to === to)
    if (idx === -1) return
    definition.value.transitions[idx] = { ...definition.value.transitions[idx], ...patch }
  }

  const deleteTransition = (from, to) => {
    definition.value.transitions = definition.value.transitions.filter(
      t => !(t.from === from && t.to === to)
    )
  }

  // ── Restrictions helpers ───────────────────────────────────────────────────

  const addRestriction = (from, to, restriction) => {
    const t = definition.value.transitions.find(t => t.from === from && t.to === to)
    if (!t) return
    t.restrictions = [...(t.restrictions ?? []), { type: 'role', message: '', ...restriction }]
  }

  const removeRestriction = (from, to, idx) => {
    const t = definition.value.transitions.find(t => t.from === from && t.to === to)
    if (!t) return
    t.restrictions = t.restrictions.filter((_, i) => i !== idx)
  }

  // ── Computed helpers ───────────────────────────────────────────────────────

  const stepByKey = computed(() =>
    Object.fromEntries((definition.value.steps ?? []).map(s => [s.key, s]))
  )

  const transitionsFrom = (key) =>
    (definition.value.transitions ?? []).filter(t => t.from === key)

  const transitionsTo = (key) =>
    (definition.value.transitions ?? []).filter(t => t.to === key)

  const isValid = computed(() => {
    const steps = definition.value.steps ?? []
    return (
      steps.length >= 2 &&
      steps.some(s => s.type === 'start') &&
      steps.some(s => ['finished', 'cancelled'].includes(s.type))
    )
  })

  // ── Reset / load ───────────────────────────────────────────────────────────

  const reset = (newDefinition = null) => {
    definition.value = newDefinition
      ? JSON.parse(JSON.stringify(newDefinition))
      : { steps: [], transitions: [] }
    isDirty.value = false
  }

  const markSaved = () => { isDirty.value = false }

  return {
    // State
    definition,
    isDirty,
    saving,
    isValid,
    // Step CRUD
    addStep,
    updateStep,
    deleteStep,
    reorderSteps,
    // Transition CRUD
    addTransition,
    updateTransition,
    deleteTransition,
    // Restriction helpers
    addRestriction,
    removeRestriction,
    // Computed
    stepByKey,
    transitionsFrom,
    transitionsTo,
    // Utils
    reset,
    markSaved,
  }
}
