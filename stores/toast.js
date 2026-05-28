// stores/toast.js
import { defineStore } from 'pinia'
import { markRaw } from 'vue'

/**
 * Store unificado de toasts. Soporta tres variants:
 *
 *  - 'alert'  → toast simple con severity + título opcional + mensaje
 *  - 'notification' → más prominente, soporta acción y no auto-dismiss
 *  - 'process' → con barra de progreso, no auto-dismiss
 *
 * Y 6 posiciones: top-left|center|right · bottom-left|center|right
 *
 * Action opcional para cualquier variant:
 *   action: { label: 'Deshacer', onClick: () => { ... } }
 */

const POSITIONS = ['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right']
const SEVERITIES = ['success','error','warning','info']

const DEFAULTS = {
  variant: 'alert',
  severity: 'info',
  position: 'top-right',
  duration: 5000,
  closable: true,
}

let _id = 0
const nextId = () => `t${++_id}`

function normalize(input, override = {}) {
  const cfg = typeof input === 'string' ? { message: input } : { ...input }
  const merged = { ...DEFAULTS, ...cfg, ...override }
  if (!POSITIONS.includes(merged.position)) merged.position = 'top-right'
  if (merged.action && typeof merged.action.onClick === 'function') {
    // Pinia evita reactivear funciones — markRaw el objeto
    merged.action = markRaw(merged.action)
  }
  return { ...merged, id: nextId(), createdAt: Date.now() }
}

export const useToastStore = defineStore('toast', {
  state: () => ({
    toasts: Object.fromEntries(POSITIONS.map(p => [p, []])),
    timeouts: {},
  }),
  getters: {
    flat(state) {
      return POSITIONS.flatMap(p => state.toasts[p])
    },
  },
  actions: {
    _push(toast) {
      this.toasts[toast.position].push(toast)
      this._scheduleRemoval(toast)
      return toast.id
    },
    _scheduleRemoval(toast) {
      if (!toast.duration || toast.duration <= 0) return
      const tid = setTimeout(() => this.dismiss(toast.id), toast.duration)
      this.timeouts[toast.id] = tid
    },

    // ── API pública ──────────────────────────────────────────────────
    show(config) {
      return this._push(normalize(config))
    },
    success(input, config = {}) {
      return this._push(normalize(input, { ...config, severity: 'success' }))
    },
    error(input, config = {}) {
      return this._push(normalize(input, { ...config, severity: 'error', duration: config.duration ?? 7000 }))
    },
    warning(input, config = {}) {
      return this._push(normalize(input, { ...config, severity: 'warning' }))
    },
    info(input, config = {}) {
      return this._push(normalize(input, { ...config, severity: 'info' }))
    },

    /** Notification — variant prominente, NO auto-dismiss por defecto. */
    notify(config = {}) {
      return this._push(normalize({ ...config, variant: 'notification', duration: config.duration ?? 0 }))
    },

    /** Process — toast con barra de progreso. Devuelve id para actualizar. */
    process(title, config = {}) {
      return this._push(normalize({
        ...config,
        variant: 'process',
        title,
        progress: 0,
        progressLabel: config.progressLabel ?? 'Iniciando…',
        duration: 0,
        closable: config.closable ?? false,
      }))
    },

    update(id, patch) {
      for (const p of POSITIONS) {
        const idx = this.toasts[p].findIndex(t => t.id === id)
        if (idx !== -1) {
          this.toasts[p][idx] = { ...this.toasts[p][idx], ...patch }
          return
        }
      }
    },
    updateProgress(id, progress, progressLabel) {
      const patch = { progress: Math.min(100, Math.max(0, progress)) }
      if (progressLabel != null) patch.progressLabel = progressLabel
      this.update(id, patch)
    },
    completeProcess(id, message = 'Completado') {
      this.update(id, {
        progress: 100,
        progressLabel: message,
        severity: 'success',
        closable: true,
      })
      // Auto-dismiss después de 2.5s
      const tid = setTimeout(() => this.dismiss(id), 2500)
      this.timeouts[id] = tid
    },
    failProcess(id, message = 'Error') {
      this.update(id, {
        progressLabel: message,
        severity: 'error',
        closable: true,
        duration: 7000,
      })
      const tid = setTimeout(() => this.dismiss(id), 7000)
      this.timeouts[id] = tid
    },

    dismiss(id) {
      if (this.timeouts[id] != null) {
        clearTimeout(this.timeouts[id])
        delete this.timeouts[id]
      }
      for (const p of POSITIONS) {
        const idx = this.toasts[p].findIndex(t => t.id === id)
        if (idx !== -1) {
          this.toasts[p].splice(idx, 1)
          return
        }
      }
    },
    clear(position) {
      if (position && this.toasts[position]) {
        for (const t of this.toasts[position]) {
          if (this.timeouts[t.id]) { clearTimeout(this.timeouts[t.id]); delete this.timeouts[t.id] }
        }
        this.toasts[position] = []
      } else {
        for (const p of POSITIONS) {
          for (const t of this.toasts[p]) {
            if (this.timeouts[t.id]) { clearTimeout(this.timeouts[t.id]); delete this.timeouts[t.id] }
          }
          this.toasts[p] = []
        }
      }
    },

    // ── Compat (deprecated) ────────────────────────────────────────
    remove(id) { this.dismiss(id) },
  },
})
