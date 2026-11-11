/** Lógica pura del historial de versiones (sin Nuxt/Vue). */
import { joinPath } from '../../useDriveBrowser/internal/browser'

export type VersionSource = 'upload' | 'replace' | 'provider_import' | 'provider_refresh' | 'restore'

export interface FileVersionEntry {
  version: number
  is_current: boolean
  original_name: string
  mime_type: string | null
  extension: string | null
  size: number
  source: VersionSource
  restored_from_version: number | null
  created_by: string | null
  created_at: string | null
  superseded_at: string | null
  download_url: string | null
}

export function versionEndpoints(filesBase: string, fileId: string) {
  const id = encodeURIComponent(fileId)
  return {
    list: joinPath(filesBase, `${id}/versions`),
    restore: (version: number) => joinPath(filesBase, `${id}/versions/${version}/restore`),
    contents: joinPath(filesBase, `${id}/contents`),
  }
}

export function versionSourceLabel(source: VersionSource, restoredFrom?: number | null): string {
  switch (source) {
    case 'upload': return 'Subida'
    case 'replace': return 'Reemplazo'
    case 'provider_import': return 'Desde Drive'
    case 'provider_refresh': return 'Actualizada desde Drive'
    case 'restore': return restoredFrom ? `Restaurada desde v${restoredFrom}` : 'Restaurada'
    default: return 'Versión'
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function versionResultMessage(res: { status: 'created' | 'unchanged'; file: { version: number } }): string {
  return res.status === 'created'
    ? `Nueva versión v${res.file.version} creada.`
    : 'Sin cambios: el contenido es igual a la versión vigente.'
}
