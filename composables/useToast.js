// composables/useToast.js
import { useToastStore } from '../stores/toast'

/**
 * useToast() — API limpia para mostrar toasts.
 *
 * ```js
 * const toast = useToast()
 *
 * toast.success('Guardado')
 * toast.error('Algo falló', { title: 'Error', duration: 8000 })
 * toast.warning('Atención')
 * toast.info('Tip')
 *
 * toast.notify({ title: 'Nueva mención', message: 'Te etiquetaron', action: { label: 'Ver', onClick: () => {} } })
 *
 * const id = toast.process('Subiendo archivo…', { position: 'bottom-right' })
 * toast.updateProgress(id, 40, '40%')
 * toast.completeProcess(id, 'Listo')
 *
 * toast.dismiss(id)
 * toast.clear() // todos
 * ```
 */
export function useToast() {
  const store = useToastStore()
  return {
    show:            store.show.bind(store),
    success:         store.success.bind(store),
    error:           store.error.bind(store),
    warning:         store.warning.bind(store),
    info:            store.info.bind(store),
    notify:          store.notify.bind(store),
    process:         store.process.bind(store),
    update:          store.update.bind(store),
    updateProgress:  store.updateProgress.bind(store),
    completeProcess: store.completeProcess.bind(store),
    failProcess:     store.failProcess.bind(store),
    dismiss:         store.dismiss.bind(store),
    clear:           store.clear.bind(store),
  }
}
