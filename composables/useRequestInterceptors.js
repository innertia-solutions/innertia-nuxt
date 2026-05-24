/**
 * Module-level singleton registry.
 * Shared by useApi (nuxt-app), useRealtime, and useDownload (nuxt-core).
 * Each layer adds interceptors at plugin init time.
 */
const interceptors = []

export function useRequestInterceptors() {
  /**
   * Register an interceptor function.
   * fn(headers: object, options: object) — mutates headers in place.
   * Idempotent: adding the same fn twice is a no-op.
   */
  const add = (fn) => {
    if (!interceptors.includes(fn)) interceptors.push(fn)
  }

  /**
   * Run all registered interceptors.
   * headers and options are passed by reference; interceptors mutate headers.
   */
  const run = (headers, options = {}) => {
    for (const fn of interceptors) fn(headers, options)
  }

  return { add, run }
}
