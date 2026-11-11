import { computed, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { driveEndpoints } from '../useDriveBrowser/internal/browser'
import { importPayload, isFinished, type FileImport } from './internal/progress'

const POLL_MS = 2000

/**
 * Importaciones desde Google Drive (innertia-laravel, Routes::registerDriveImport):
 *   POST {base}/files/imports → 202 {data}   · GET {base}/files/imports/{id}
 *   POST {base}/files/{fileId}/refresh → 202 {data}
 * El trabajo corre en cola: `track(id)` consulta cada 2 s hasta done/failed.
 */
export function useFileImports(base: MaybeRefOrGetter<string>) {
  const api = useApi()
  const endpoints = computed(() => driveEndpoints(toValue(base)))

  const start = useMutation({
    mutationFn: async (payload: Parameters<typeof importPayload>[0]) =>
      ((await api.post(endpoints.value.imports, importPayload(payload))) as any).data as FileImport,
  })

  const refresh = useMutation({
    mutationFn: async (fileId: string) =>
      ((await api.post(endpoints.value.refresh(fileId))) as any).data as FileImport,
  })

  /** Sigue un proceso hasta que termina (polling; se detiene solo). */
  function track(importId: Ref<string | null>) {
    return useQuery({
      queryKey: computed(() => ['files', 'imports', importId.value]),
      queryFn: async () => ((await api.get(endpoints.value.importShow(importId.value as string))) as any).data as FileImport,
      enabled: computed(() => !!importId.value),
      refetchInterval: (q: any) => (isFinished(q.state.data?.status) ? false : POLL_MS),
      retry: 2,
    })
  }

  return { start, refresh, track }
}
