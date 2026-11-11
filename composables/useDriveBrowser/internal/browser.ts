/**
 * Lógica pura del navegador de Google Drive (sin Nuxt/Vue): endpoints, ubicación,
 * migas, selección. La consumen useDriveBrowser y <Files.DriveBrowser>.
 */

export interface DriveEntry {
  id: string
  name: string
  mime_type: string
  size: number | null
  modified_time: string | null
  web_url: string | null
  drive_id: string | null
  is_folder: boolean
  is_native: boolean
}

export interface Crumb { id: string; name: string }
export interface SharedDrive { id: string; name: string }

/** drive null = Mi unidad. stack = carpetas abiertas bajo la raíz de la unidad. */
export interface DriveLocation { drive: SharedDrive | null; stack: Crumb[] }

export const MY_DRIVE = 'Mi unidad'

/** Tope de la API (POST files/imports admite hasta 200 ids). */
export const MAX_SELECTION = 200

export function joinPath(base: string, path: string): string {
  const clean = (base ?? '').replace(/^\/+|\/+$/g, '')
  return clean ? `${clean}/${path}` : path
}

export function driveEndpoints(base: string) {
  return {
    browse: joinPath(base, 'drive/browse'),
    item: (id: string) => joinPath(base, `drive/items/${encodeURIComponent(id)}`),
    folders: joinPath(base, 'drive/folders'),
    imports: joinPath(base, 'files/imports'),
    importShow: (id: string) => joinPath(base, `files/imports/${encodeURIComponent(id)}`),
    refresh: (fileId: string) => joinPath(base, `files/${encodeURIComponent(fileId)}/refresh`),
  }
}

export function rootLocation(drive: SharedDrive | null = null): DriveLocation {
  return { drive, stack: [] }
}

export function enter(loc: DriveLocation, folder: Crumb): DriveLocation {
  return { ...loc, stack: [...loc.stack, { id: folder.id, name: folder.name }] }
}

/** depth 0 = raíz de la unidad; depth n = deja las primeras n carpetas. */
export function goTo(loc: DriveLocation, depth: number): DriveLocation {
  return { ...loc, stack: loc.stack.slice(0, Math.max(0, depth)) }
}

export function current(loc: DriveLocation): Crumb {
  return loc.stack.at(-1) ?? { id: loc.drive?.id ?? 'root', name: loc.drive?.name ?? MY_DRIVE }
}

export function breadcrumb(loc: DriveLocation): Crumb[] {
  return [{ id: loc.drive?.id ?? 'root', name: loc.drive?.name ?? MY_DRIVE }, ...loc.stack]
}

/** Query params de GET drive/browse (el backend devuelve shared_drives solo sin parent ni drive_id). */
export function browseParams(loc: DriveLocation, foldersOnly: boolean): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (loc.stack.length) params.parent = current(loc).id
  if (loc.drive) params.drive_id = loc.drive.id
  if (foldersOnly) params.folders_only = 1
  return params
}

/** La raíz de Mi unidad no es un destino útil; la raíz de una unidad compartida sí. */
export function canPickCurrentFolder(loc: DriveLocation): boolean {
  return loc.stack.length > 0 || loc.drive !== null
}

/**
 * Ubicación para abrir el navegador EN un ítem ya elegido, a partir de GET drive/items/{id}.
 * path excluye el ítem; puede venir parcial (sin acceso a la raíz) → todo bajo Mi unidad.
 */
export function locationFromPath(item: Crumb & { drive_id?: string | null }, path: Crumb[]): DriveLocation {
  const self = { id: item.id, name: item.name }
  if (!path.length) return { drive: null, stack: [self] }

  const [root, ...rest] = path
  if (item.drive_id && root.id === item.drive_id) {
    return { drive: { id: item.drive_id, name: root.name }, stack: [...rest, self] }
  }
  if (root.id === 'root') return { drive: null, stack: [...rest, self] }

  return { drive: null, stack: [...path, self] }
}

/** accept: mimes exactos o comodines tipo 'image/*'. Vacío = todo. */
export function matchesAccept(entry: DriveEntry, accept: string[]): boolean {
  if (!accept.length) return true
  return accept.some(a => a.endsWith('/*') ? entry.mime_type.startsWith(a.slice(0, -1)) : entry.mime_type === a)
}

/** Con filtro accept las carpetas solo se navegan (no se eligen). */
export function isSelectable(entry: DriveEntry, accept: string[]): boolean {
  return entry.is_folder ? accept.length === 0 : matchesAccept(entry, accept)
}

export function toggleSelection(list: DriveEntry[], entry: DriveEntry, multiple: boolean): DriveEntry[] {
  if (list.some(e => e.id === entry.id)) return list.filter(e => e.id !== entry.id)
  if (!multiple) return [entry]
  if (list.length >= MAX_SELECTION) return list
  return [...list, entry]
}
