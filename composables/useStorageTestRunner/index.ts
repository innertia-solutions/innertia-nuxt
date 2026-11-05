import { ref, computed } from 'vue'
import { runSteps, type StepResult } from './internal/engine'
import { buildStorageSteps, sha256Hex, type StorageTestOptions } from './internal/steps'

export type { StepResult, StepStatus } from './internal/engine'

/**
 * Pruebas de almacenamiento de punta a punta contra la API real de Files,
 * con un archivo elegido por el usuario. Ver <Files.StorageTestRunner>.
 */
export function useStorageTestRunner(options: StorageTestOptions) {
  const api = useApi()
  const { upload } = useFile()

  const initial = (): StepResult[] => buildStorageSteps().map(d => ({ id: d.id, label: d.label, status: 'pending' }))
  const results = ref<StepResult[]>(initial())
  const running = ref(false)
  let controller: AbortController | null = null

  const summary = computed(() => {
    const count = (s: string) => results.value.filter(r => r.status === s).length
    return { ok: count('ok'), failed: count('failed'), skipped: count('skipped'), total: results.value.length }
  })

  async function run(file: File) {
    if (running.value) return
    running.value = true
    controller = new AbortController()
    try {
      await runSteps(
        buildStorageSteps(),
        {
          api, upload, hash: sha256Hex,
          fetchFn: (url: string, init?: RequestInit) => fetch(url, init),
          ...options,
          file,
          stamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
          state: {},
        },
        (r) => { results.value = r },
        controller.signal,
      )
    } finally {
      running.value = false
      controller = null
    }
  }

  function abort() { controller?.abort() }
  function reset() { if (!running.value) results.value = initial() }

  return { results, running, summary, run, abort, reset }
}
