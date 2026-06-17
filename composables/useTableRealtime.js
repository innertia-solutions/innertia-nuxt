/**
 * Suscribe un componente de datos (table/kanban/tree) a uno o varios canales
 * `entity.{tabla}` y dispara reloadFn() debounceado al recibir `{canal}.changed`.
 *
 * - sync(channels): difunde la lista de canales (de meta.channels). Suscribe los
 *   nuevos, des-suscribe los que ya no están. Idempotente: llamar tras cada fetch.
 * - teardown(): des-suscribe todo (llamar en onBeforeUnmount).
 *
 * Coalesce: varios pings en la ventana de debounce → un solo reload.
 * In-flight guard: si llega un ping mientras reloadFn está corriendo, re-dispara al terminar.
 */
export function useTableRealtime(reloadFn, { debounceMs = 400 } = {}) {
  const rt = useRealtime()
  const subscribed = new Set()
  let timer = null
  let inFlight = false
  let pending = false

  const fire = async () => {
    inFlight = true
    try { await reloadFn() }
    finally {
      inFlight = false
      if (pending) { pending = false; ping() }
    }
  }

  const ping = () => {
    if (inFlight) { pending = true; return }
    clearTimeout(timer)
    timer = setTimeout(fire, debounceMs)
  }

  const sync = async (channels = []) => {
    const next = new Set(Array.isArray(channels) ? channels.filter(Boolean) : [])
    if (!next.size && !subscribed.size) return
    if (next.size) await rt.connect()

    for (const ch of [...subscribed]) {
      if (!next.has(ch)) { rt.unsubscribe(ch); subscribed.delete(ch) }
    }
    for (const ch of next) {
      if (!subscribed.has(ch)) {
        rt.subscribe(ch, { [`${ch}.changed`]: ping })
        subscribed.add(ch)
      }
    }
  }

  const teardown = () => {
    clearTimeout(timer)
    for (const ch of [...subscribed]) rt.unsubscribe(ch)
    subscribed.clear()
  }

  return { sync, teardown }
}
