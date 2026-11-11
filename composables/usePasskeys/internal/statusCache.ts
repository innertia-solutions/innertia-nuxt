// Caché de la promesa del estado (interruptor) de passkeys, por base ('auth' | 'platform/auth').
// Lógica pura (testeable en node): una consulta por base durante la vida de la página;
// un fallo cuenta como "desactivado" y NO se cachea (la próxima lectura reintenta).

export type StatusFetcher = (base: string) => Promise<{ enabled?: boolean } | null | undefined>

export interface StatusCache {
  /** Estado de la base; nunca rechaza (fallo → false). */
  get(base: string): Promise<boolean>
  /** Olvida una base (o todas) para que la próxima lectura consulte de nuevo. */
  reset(base?: string): void
}

export function createStatusCache(): { for(fetcher: StatusFetcher): StatusCache } {
  const promises = new Map<string, Promise<boolean>>()
  return {
    for(fetcher) {
      return {
        get(base) {
          let p = promises.get(base)
          if (!p) {
            const created: Promise<boolean> = (async () => {
              try {
                const res = await fetcher(base)
                return res?.enabled === true
              } catch {
                if (promises.get(base) === created) promises.delete(base)
                return false
              }
            })()
            p = created
            promises.set(base, p)
          }
          return p
        },
        reset(base) {
          if (base) promises.delete(base)
          else promises.clear()
        },
      }
    },
  }
}
