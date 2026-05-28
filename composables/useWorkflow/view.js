import { ref, computed, watch } from 'vue'

/**
 * useWorkflowView — estado operacional de un workflow en runtime.
 *
 * Responsabilidad: cargar items, derivar columnas desde la definición,
 * validar y ejecutar transiciones, manejar el view mode del board.
 *
 * NO edita la definición — eso es trabajo de useWorkflowForm.
 *
 * @param {Ref<Object>} definitionRef — ref reactivo a { steps, transitions }
 * @param {Object}      options
 *   @param {string}    options.endpoint      — endpoint para cargar items via useApi()
 *   @param {Object}    options.params        — params extra para el fetch
 *   @param {string}    options.stateKey      — campo del item que indica el step actual (default: 'current_step')
 *   @param {Function}  options.onTransition  — async (item, toStep, fromStep) => void — consumer llama su API
 *   @param {string}    options.defaultView   — 'kanban' | 'table' | 'flow' | 'funnel' (default: 'kanban')
 *   @param {boolean}   options.validateTransitions — si false, permite cualquier movimiento (default: true)
 */
export function useWorkflowView(definitionRef, options = {}) {
  const {
    endpoint            = null,
    params              = {},
    stateKey            = 'current_step',
    onTransition        = null,
    defaultView         = 'kanban',
    validateTransitions = true,
  } = options

  // ── Items ──────────────────────────────────────────────────────────────────

  const items   = ref([])
  const loading = ref(false)
  const error   = ref(null)
  const total   = computed(() => items.value.length)

  const api = useApi?.() ?? null   // auto-import de Nuxt

  const load = async () => {
    if (!endpoint) return
    loading.value = true
    error.value   = null
    try {
      const res = await api.get(endpoint, params)
      items.value = Array.isArray(res) ? res : (res.data ?? [])
    } catch (e) {
      error.value = e?.message ?? 'Error al cargar'
    } finally {
      loading.value = false
    }
  }

  const reload = () => load()

  // Cargar al montar si hay endpoint
  if (endpoint) {
    // onMounted no está disponible aquí — el consumer debe llamar load() o
    // lo hacemos con watch en el primer tick
    watch(() => endpoint, load, { immediate: true })
  }

  // ── Columnas derivadas de la definición ────────────────────────────────────

  const STEP_TYPE_COLOR = {
    start:          'slate',
    in_progress:    'blue',
    pause_internal: 'amber',
    pause_external: 'orange',
    finished:       'green',
    cancelled:      'red',
  }

  const columns = computed(() =>
    (definitionRef.value?.steps ?? []).map(step => ({
      key:   step.key,
      label: step.label,
      color: STEP_TYPE_COLOR[step.type] ?? 'slate',
      type:  step.type,
    }))
  )

  // ── Validación de transiciones ─────────────────────────────────────────────

  /**
   * Verifica si existe una transición definida entre dos steps.
   */
  const canTransition = (fromStep, toStep) => {
    if (!validateTransitions) return true
    return (definitionRef.value?.transitions ?? []).some(
      t => t.from === fromStep && t.to === toStep
    )
  }

  /**
   * Devuelve los steps destino disponibles desde un step dado.
   */
  const availableTransitions = (fromStep) =>
    (definitionRef.value?.transitions ?? [])
      .filter(t => t.from === fromStep)
      .map(t => ({
        key:          t.to,
        label:        definitionRef.value?.steps?.find(s => s.key === t.to)?.label ?? t.to,
        transitionLabel: t.label ?? '',
        restrictions: t.restrictions ?? [],
      }))

  /**
   * Devuelve la config de una transición específica.
   */
  const getTransition = (fromStep, toStep) =>
    (definitionRef.value?.transitions ?? []).find(
      t => t.from === fromStep && t.to === toStep
    ) ?? null

  // ── onMove — para KanbanStandard ──────────────────────────────────────────

  /**
   * Función compatible con KanbanStandard :move-mutation.
   * Valida la transición y llama al onTransition del consumer.
   *
   * @param {string|Object} itemOrId — id del item o el item completo
   * @param {string}        toStep   — step destino
   * @param {string}        fromStep — step origen (opcional, se busca en items)
   */
  const onMove = async (itemOrId, toStep, fromStep) => {
    const id   = typeof itemOrId === 'object' ? itemOrId.id : itemOrId
    const item = items.value.find(i => i.id === id) ?? itemOrId

    const from = fromStep ?? item?.[stateKey]

    if (validateTransitions && !canTransition(from, toStep)) {
      console.warn(`[useWorkflowView] Transición bloqueada: ${from} → ${toStep}`)
      return false
    }

    // Optimistic update
    const idx = items.value.findIndex(i => i.id === id)
    if (idx >= 0) items.value[idx] = { ...items.value[idx], [stateKey]: toStep }

    try {
      if (onTransition) await onTransition(item, toStep, from)
      return true
    } catch (e) {
      // Rollback
      if (idx >= 0) items.value[idx] = { ...items.value[idx], [stateKey]: from }
      error.value = e?.message ?? 'Error en transición'
      return false
    }
  }

  // ── Funnel data — para WorkflowFunnel / Chart ──────────────────────────────

  /**
   * Cuenta de items por step — útil para la vista funnel.
   */
  const funnelData = computed(() => {
    const counts = Object.fromEntries(
      (definitionRef.value?.steps ?? []).map(s => [s.key, 0])
    )
    for (const item of items.value) {
      const step = item[stateKey]
      if (step in counts) counts[step]++
    }
    return (definitionRef.value?.steps ?? []).map(step => ({
      key:   step.key,
      label: step.label,
      type:  step.type,
      count: counts[step.key] ?? 0,
    }))
  })

  // ── View mode ──────────────────────────────────────────────────────────────

  const VALID_VIEWS = ['kanban', 'table', 'flow', 'funnel']

  const viewMode    = ref(VALID_VIEWS.includes(defaultView) ? defaultView : 'kanban')
  const setViewMode = (mode) => {
    if (VALID_VIEWS.includes(mode)) viewMode.value = mode
  }

  // ── Item helpers ───────────────────────────────────────────────────────────

  const itemsByStep = computed(() => {
    const map = Object.fromEntries(
      (definitionRef.value?.steps ?? []).map(s => [s.key, []])
    )
    for (const item of items.value) {
      const step = item[stateKey]
      if (step in map) map[step].push(item)
    }
    return map
  })

  const setItems = (newItems) => { items.value = newItems }

  return {
    // Items
    items,
    loading,
    error,
    total,
    load,
    reload,
    setItems,
    itemsByStep,
    // Columnas derivadas
    columns,
    stateKey,
    // Transición
    canTransition,
    availableTransitions,
    getTransition,
    onMove,
    // Funnel
    funnelData,
    // View mode
    viewMode,
    setViewMode,
  }
}
