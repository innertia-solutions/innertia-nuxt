/**
 * useWorkflow — punto de entrada único del sistema de workflows.
 *
 * Estructura:
 *   useWorkflowForm  → edición de definiciones (steps, transitions, restrictions)
 *   useWorkflowView  → estado operacional (items, columnas, onMove, viewMode)
 *
 * Uso independiente:
 *   import { useWorkflowForm } from '~/composables/useWorkflow'
 *   import { useWorkflowView } from '~/composables/useWorkflow'
 *
 * Con auto-import de Nuxt también funcionan directamente:
 *   const form = useWorkflowForm(initialDefinition)
 *   const view = useWorkflowView(form.definition, { endpoint: 'tasks' })
 */

export { useWorkflowForm } from './form.js'
export { useWorkflowView } from './view.js'
