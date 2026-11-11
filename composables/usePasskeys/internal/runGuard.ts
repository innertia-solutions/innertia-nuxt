// Seguimiento de "corridas" (lógica pura, testeable en node): cada arranque del
// autocompletado pide un id con next(); una corrida sigue vigente mientras sea la
// última y el guard no se haya liberado. Sirve para descartar resultados de
// corridas viejas (await en vuelo) aunque el AbortController de simplewebauthn
// todavía no exista.

export interface RunGuard {
  /** Invalida la corrida actual y devuelve el id de una nueva. */
  next(): number
  /** Invalida la corrida actual sin abrir otra. */
  invalidate(): void
  /** true si `id` es la última corrida y el guard no se liberó. */
  isCurrent(id: number): boolean
  /** Libera el guard: ninguna corrida (actual o futura) queda vigente. */
  dispose(): void
  readonly disposed: boolean
}

export function createRunGuard(): RunGuard {
  let current = 0
  let disposed = false
  return {
    next() {
      current += 1
      return current
    },
    invalidate() {
      current += 1
    },
    isCurrent(id: number) {
      return !disposed && id === current
    },
    dispose() {
      disposed = true
      current += 1
    },
    get disposed() {
      return disposed
    },
  }
}
