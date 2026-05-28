// composables/useModal.js
import { useModalStore } from '../stores/modal'

/**
 * useModal() — API promise-based para modales programáticos.
 *
 * Requiere <ModalHost /> montado una vez en el layout root.
 *
 * ```js
 * const { confirm, alert, prompt, open } = useModal()
 *
 * if (await confirm({ severity: 'danger', message: '¿Eliminar?' })) {
 *   // user confirmed
 * }
 *
 * await alert({ severity: 'success', message: 'Listo' })
 *
 * const name = await prompt({ title: 'Nombre', placeholder: 'Tu nombre' })
 *
 * const result = await open(MyCustomModal, { foo: 'bar' })
 * ```
 */
export function useModal() {
  const store = useModalStore()

  /** Confirmación. Resuelve true/false. */
  const confirm = (opts = {}) => store.open({
    kind: 'confirm',
    props: {
      severity:    opts.severity    ?? 'question',
      title:       opts.title       ?? '',
      message:     opts.message     ?? '',
      confirmText: opts.confirmText ?? 'Confirmar',
      cancelText:  opts.cancelText  ?? 'Cancelar',
    },
  })

  /** Alert simple — solo botón OK. Resuelve undefined. */
  const alert = (opts = {}) => store.open({
    kind: 'alert',
    props: {
      severity:    opts.severity    ?? 'info',
      title:       opts.title       ?? '',
      message:     opts.message     ?? '',
      confirmText: opts.confirmText ?? 'Entendido',
    },
  })

  /** Prompt — pide un string. Resuelve string|null (null si cancela). */
  const prompt = (opts = {}) => store.open({
    kind: 'prompt',
    props: {
      title:       opts.title       ?? 'Ingresar valor',
      message:     opts.message     ?? '',
      placeholder: opts.placeholder ?? '',
      defaultValue: opts.defaultValue ?? '',
      confirmText: opts.confirmText ?? 'Aceptar',
      cancelText:  opts.cancelText  ?? 'Cancelar',
      required:    opts.required    ?? false,
    },
  })

  /** Modal custom — montá tu propio componente. Resuelve con lo que pase a $close(value). */
  const open = (component, props = {}) => store.open({
    kind: 'component',
    component,
    props,
  })

  return { confirm, alert, prompt, open }
}
