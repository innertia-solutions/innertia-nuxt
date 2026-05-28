// stores/modal.js
import { defineStore } from 'pinia'
import { markRaw } from 'vue'

/**
 * Cola de modales programáticos. Renderizada por <ModalHost />.
 *
 * Cada entry: { id, kind: 'confirm'|'alert'|'prompt'|'component',
 *               props: object, component?: Component, resolve: fn }
 *
 * `component` se guarda con markRaw para que Pinia no lo reactivee.
 */
let _id = 0
const nextId = () => `m${++_id}`

export const useModalStore = defineStore('modal', {
  state: () => ({
    queue: [],
  }),
  actions: {
    push(entry) {
      this.queue.push(entry)
      return entry.id
    },
    remove(id) {
      const idx = this.queue.findIndex(e => e.id === id)
      if (idx !== -1) this.queue.splice(idx, 1)
    },
    resolve(id, value) {
      const entry = this.queue.find(e => e.id === id)
      if (!entry) return
      entry.resolve(value)
      this.remove(id)
    },
    /** Crea entry + devuelve Promise que se resuelve con .resolve(id, value) */
    open({ kind, props = {}, component = null }) {
      return new Promise((resolve) => {
        this.push({
          id: nextId(),
          kind,
          props,
          component: component ? markRaw(component) : null,
          resolve,
        })
      })
    },
  },
})
