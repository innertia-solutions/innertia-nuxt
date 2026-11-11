import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import {
  driveEndpoints, rootLocation, enter as enterLoc, goTo as goToLoc, current as currentOf,
  breadcrumb as breadcrumbOf, browseParams, canPickCurrentFolder, locationFromPath,
  type DriveEntry, type DriveLocation, type SharedDrive, type Crumb,
} from './internal/browser'

/**
 * Navegador de Google Drive sobre innertia-laravel (Routes::registerDriveImport):
 *   GET  {base}/drive/browse  · GET {base}/drive/items/{id} · POST {base}/drive/folders
 * `base` = prefijo con el que el producto registró las rutas (p. ej. 'platform').
 * `enabled: false` no lista la carpeta (solo se usa `info`/`openAt`), p. ej. en un campo.
 */
export function useDriveBrowser(options: MaybeRefOrGetter<{ base: string; foldersOnly?: boolean; enabled?: boolean }>) {
  const api = useApi()
  const queryClient = useQueryClient()
  const opts = computed(() => toValue(options))
  const endpoints = computed(() => driveEndpoints(opts.value.base))

  const location = ref<DriveLocation>(rootLocation())
  const sharedDrives = ref<SharedDrive[]>([])
  const params = computed(() => browseParams(location.value, !!opts.value.foldersOnly))

  const query = useQuery({
    queryKey: computed(() => ['drive', 'browse', endpoints.value.browse, params.value]),
    queryFn: async () => {
      const res: any = await api.get(endpoints.value.browse, { params: params.value })
      if (Array.isArray(res?.shared_drives)) sharedDrives.value = res.shared_drives
      return (res?.items ?? []) as DriveEntry[]
    },
    enabled: computed(() => opts.value.enabled !== false),
    staleTime: 30_000,
    retry: false,
  })

  const createFolder = useMutation({
    mutationFn: (name: string) => api.post(endpoints.value.folders, { name, parent: currentOf(location.value).id }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['drive', 'browse'] })
      if (res?.item) location.value = enterLoc(location.value, res.item)
    },
  })

  /** Abre el navegador en un ítem ya guardado (p. ej. la carpeta configurada). */
  async function openAt(id: string) {
    const res: any = await api.get(endpoints.value.item(id))
    location.value = locationFromPath(res.item, res.path ?? [])
    return res as { item: DriveEntry; path: Crumb[] }
  }

  return {
    location,
    sharedDrives,
    items: computed(() => query.data.value ?? []),
    isLoading: computed(() => query.isFetching.value),
    error: computed(() => (query.error.value ? ((query.error.value as any)?.data?.message ?? 'No se pudo listar Google Drive.') : null)),
    current: computed(() => currentOf(location.value)),
    breadcrumb: computed(() => breadcrumbOf(location.value)),
    canPickCurrent: computed(() => canPickCurrentFolder(location.value)),
    selectDrive: (drive: SharedDrive | null) => { location.value = rootLocation(drive) },
    enter: (folder: Crumb) => { location.value = enterLoc(location.value, folder) },
    goTo: (depth: number) => { location.value = goToLoc(location.value, depth) },
    openAt,
    info: (id: string) => api.get(endpoints.value.item(id)) as Promise<{ item: DriveEntry; path: Crumb[] }>,
    createFolder,
    refetch: () => query.refetch(),
  }
}
