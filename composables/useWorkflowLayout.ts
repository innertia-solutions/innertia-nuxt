/**
 * Auto-layout para workflow definitions.
 *
 * Usa BFS desde el nodo start (en vez de Kahn) para manejar ciclos
 * correctamente. Back-edges (transiciones hacia nodos ya visitados con
 * capa ≤ origen) se marcan como isBackEdge:true y usan handles top para
 * que su path se rutee por encima del row de nodos.
 */

const NODE_W = 208   // w-52 en Tailwind
const NODE_H = 96    // alto aproximado de StepNode con descripción
const H_GAP  = 100   // espacio horizontal entre columnas (para labels de edge)
const V_GAP  = 40    // espacio vertical entre nodos en misma columna

// ── Helpers privados ──────────────────────────────────────────────────────────

/**
 * BFS desde el nodo start para asignar capa (layer) a cada step.
 * Nodos no alcanzables se colocan en max_layer + 1.
 */
function buildLayerMap(steps, transitions) {
  if (!steps.length) return {}
  const keys     = steps.map(s => s.key)
  const startKey = steps.find(s => s.type === 'start')?.key ?? keys[0]

  // Adjacency list (solo forward)
  const adj = Object.fromEntries(keys.map(k => [k, []]))
  for (const t of transitions) {
    if (adj[t.from] !== undefined) adj[t.from].push(t.to)
  }

  // BFS
  const layer = {}
  const queue = [startKey]
  layer[startKey] = 0
  let head = 0

  while (head < queue.length) {
    const node = queue[head++]
    for (const nb of adj[node] ?? []) {
      if (!(nb in layer)) {
        layer[nb] = layer[node] + 1
        queue.push(nb)
      }
    }
  }

  // Nodos desconectados → capa extra al final
  const maxL = Math.max(-1, ...Object.values(layer))
  for (const k of keys) {
    if (!(k in layer)) layer[k] = maxL + 1
  }

  return layer
}

/**
 * Convierte un layerMap en posiciones x/y.
 * Cada capa es una columna; los nodos de una misma capa se centran verticalmente.
 */
function computePositions(steps, layerMap) {
  const groups = {}
  for (const s of steps) {
    const l = layerMap[s.key] ?? 0
    if (!groups[l]) groups[l] = []
    groups[l].push(s.key)
  }

  const positions = {}
  for (const [l, group] of Object.entries(groups)) {
    const col    = parseInt(l)
    const totalH = group.length * NODE_H + (group.length - 1) * V_GAP
    const startY = -totalH / 2
    for (let row = 0; row < group.length; row++) {
      positions[group[row]] = {
        x: col * (NODE_W + H_GAP),
        y: startY + row * (NODE_H + V_GAP),
      }
    }
  }

  return positions
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Calcula posiciones { x, y } para cada step.
 * Exportado para uso directo en Builder (relayout).
 *
 * @param {Array} steps
 * @param {Array} transitions
 * @returns {Record<string, { x: number, y: number }>}
 */
export function autoLayoutWorkflow(steps, transitions) {
  const layer = buildLayerMap(steps, transitions)
  return computePositions(steps, layer)
}

/**
 * Convierte una workflow definition al formato nodes/edges de Vue Flow.
 *
 * Back-edges (transiciones que van hacia una capa ≤ origen) reciben:
 *   - data.isBackEdge = true
 *   - sourceHandle: 'top-source' / targetHandle: 'top-target'
 *     (StepNode expone esos handles invisibles en Position.Top)
 */
export function definitionToFlow(config) {
  const layers    = buildLayerMap(config.steps ?? [], config.transitions ?? [])
  const positions = computePositions(config.steps ?? [], layers)

  const nodes = (config.steps ?? []).map(step => ({
    id:       step.key,
    type:     'step',
    position: step.position ?? positions[step.key] ?? { x: 0, y: 0 },
    data:     { ...step },
  }))

  const edges = (config.transitions ?? []).map(t => {
    const fromL   = layers[t.from] ?? 0
    const toL     = layers[t.to]   ?? 0
    const isBack  = fromL >= toL

    return {
      id:        `${t.from}__${t.to}`,
      source:    t.from,
      target:    t.to,
      type:      'transition',
      label:     t.label ?? '',
      data:      { ...t, isBackEdge: isBack },
      markerEnd: { type: 'arrowclosed' },
      // Back-edges: rutear por los handles top para que el path arque por encima
      ...(isBack ? { sourceHandle: 'top-source', targetHandle: 'top-target' } : {}),
    }
  })

  return { nodes, edges }
}

/**
 * Convierte nodes/edges de Vue Flow de vuelta al config JSON de Laravel.
 * Filtra isBackEdge del data (es metadata de layout, no del dominio).
 */
export function flowToDefinition(nodes, edges) {
  const steps = nodes.map(n => ({
    ...n.data,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
  }))

  const transitions = edges.map(e => {
    // eslint-disable-next-line no-unused-vars
    const { isBackEdge, ...rest } = e.data ?? {}
    return {
      ...rest,
      from:  e.source,
      to:    e.target,
      label: e.label ?? rest.label ?? '',
    }
  })

  return { steps, transitions }
}
