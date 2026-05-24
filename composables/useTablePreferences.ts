import { useDebounceFn } from '@vueuse/core'

export interface TablePreferences {
  pinning?: { left: string[], right: string[] }
  visibility?: Record<string, boolean>
  order?: string[]
}

export function useTablePreferences(tableName: string) {
  const api = useApi()
  const prefKey = `table:${tableName}:columns`

  const preferences = ref<TablePreferences>({})

  const load = async () => {
    try {
      const data = await api.get(`auth/me/preferences/${prefKey}`)
      preferences.value = data?.value ?? {}
    } catch {
      preferences.value = {}
    }
  }

  const save = useDebounceFn(async (value: TablePreferences) => {
    try {
      await api.put(`auth/me/preferences/${prefKey}`, { value, cast: 'json' })
    } catch {
      // silent fail — preferencias no son críticas
    }
  }, 800)

  return { preferences, load, save }
}
