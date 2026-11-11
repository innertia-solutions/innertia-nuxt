/**
 * Lógica pura de importaciones desde Drive (sin Nuxt/Vue). La consumen
 * useFileImports, <Files.DriveImport> y <Files.ProviderOrigin>.
 */

export type ImportStatus = 'pending' | 'running' | 'done' | 'failed'
export type ItemResult = 'imported' | 'updated' | 'unchanged' | 'skipped' | 'failed'

export interface ImportItem {
  result: ItemResult
  external_id: string | null
  name: string | null
  path?: string
  reason?: string
  file_id?: string
  is_folder?: boolean
}

export interface FileImport {
  id: string
  kind: 'import' | 'refresh'
  status: ImportStatus
  found: number
  imported: number
  updated: number
  unchanged: number
  skipped: number
  failed: number
  items: ImportItem[]
  error: string | null
  file_id?: string | null
  target_directory_id?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export const RESULT_ORDER: ItemResult[] = ['imported', 'updated', 'unchanged', 'skipped', 'failed']

export const RESULT_LABELS: Record<ItemResult, string> = {
  imported: 'Importados',
  updated: 'Actualizados',
  unchanged: 'Sin cambios',
  skipped: 'Omitidos',
  failed: 'Con error',
}

export function importPayload(opts: {
  items: Array<string | { id: string }>
  directoryId?: string | null
  nativeFormat?: 'office' | 'pdf'
  visibility?: 'public' | 'auth' | 'restricted' | null
}) {
  const ids = [...new Set(opts.items.map(i => (typeof i === 'string' ? i : i.id)))]
  const payload: Record<string, unknown> = { items: ids }
  if (opts.directoryId) payload.target_directory_id = opts.directoryId
  payload.native_format = opts.nativeFormat ?? 'office'
  if (opts.visibility) payload.visibility = opts.visibility
  return payload
}

export function isFinished(status: ImportStatus | undefined | null): boolean {
  return status === 'done' || status === 'failed'
}

export function processedCount(imp: Pick<FileImport, 'imported' | 'updated' | 'unchanged' | 'skipped' | 'failed'>): number {
  return imp.imported + imp.updated + imp.unchanged + imp.skipped + imp.failed
}

/** null mientras no se conoce el total (aún recorriendo Drive). */
export function progressPercent(imp: FileImport): number | null {
  if (!imp.found) return null
  return Math.min(100, Math.round((processedCount(imp) / imp.found) * 100))
}

export function groupItems(items: ImportItem[]): { result: ItemResult; label: string; items: ImportItem[] }[] {
  return RESULT_ORDER
    .map(result => ({ result, label: RESULT_LABELS[result], items: items.filter(i => i.result === result) }))
    .filter(g => g.items.length > 0)
}

export function itemLabel(item: ImportItem): string {
  const name = item.name ?? item.external_id ?? '—'
  return item.path ? `${item.path}/${name}` : name
}

export function selectionFlags(entries: Array<{ is_folder: boolean; is_native: boolean }>) {
  return {
    hasFolders: entries.some(e => e.is_folder),
    hasNatives: entries.some(e => e.is_native),
  }
}

export function refreshOutcome(imp: FileImport): { kind: 'updated' | 'unchanged' | 'failed'; message: string } {
  if (imp.status === 'failed') {
    return { kind: 'failed', message: imp.error || 'No se pudo actualizar desde Google Drive.' }
  }
  return imp.updated > 0
    ? { kind: 'updated', message: 'Actualizado desde Google Drive: se creó una nueva versión.' }
    : { kind: 'unchanged', message: 'Sin cambios: el archivo ya estaba al día con Google Drive.' }
}
