import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { versionEndpoints, type FileVersionEntry } from './internal/versions'

/**
 * Historial de versiones de un archivo (innertia-laravel, Files\Routes::register):
 *   GET {filesBase}/{id}/versions · POST …/versions/{n}/restore · POST …/contents (multipart)
 */
export function useFileVersions(options: MaybeRefOrGetter<{ filesBase: string; fileId: string | null }>) {
  const api = useApi()
  const { upload } = useFile()
  const queryClient = useQueryClient()
  const opts = computed(() => toValue(options))
  const endpoints = computed(() => (opts.value.fileId ? versionEndpoints(opts.value.filesBase, opts.value.fileId) : null))
  const key = computed(() => ['files', 'versions', opts.value.filesBase, opts.value.fileId])
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['files', 'versions'] })

  const list = useQuery({
    queryKey: key,
    queryFn: async () => ((await api.get(endpoints.value!.list)) as any).data as FileVersionEntry[],
    enabled: computed(() => !!endpoints.value),
  })

  const restore = useMutation({
    mutationFn: (version: number) => api.post(endpoints.value!.restore(version)) as Promise<any>,
    onSuccess: invalidate,
  })

  const replace = useMutation({
    mutationFn: (file: File) => upload(endpoints.value!.contents, file, { field: 'file' }) as Promise<any>,
    onSuccess: invalidate,
  })

  return { list, restore, replace, invalidate }
}
