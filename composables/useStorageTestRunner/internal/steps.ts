import type { StepDef } from './engine'

/** Deps inyectadas (en la app: useApi/useFile/fetch; en tests: backend falso). */
export interface StorageTestDeps {
  api: {
    get: (path: string, opts?: any) => Promise<any>
    post: (path: string, body?: any, opts?: any) => Promise<any>
    patch: (path: string, body?: any, opts?: any) => Promise<any>
    delete: (path: string, opts?: any) => Promise<any>
  }
  upload: (endpoint: string, file: File, opts?: { extraData?: Record<string, any>, signal?: AbortSignal }) => Promise<any>
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>
  hash: (blob: Blob) => Promise<string>
}

export interface StorageTestOptions {
  filesBase: string
  directoriesBase: string
  /** Si viene, la subida exige file.disk === expectedDisk. */
  expectedDisk?: string | null
  /** Incluir el paso de permisos (grants). */
  grants?: boolean
  /**
   * Campos del grantee: `{ grantable_type, grantable_id, grantable_class }`.
   * Obligatorio salvo que el backend rellene por defecto el usuario autenticado
   * (como hace el controlador de platform de sumando).
   */
  grantee?: Record<string, string> | null
}

export interface StorageTestState {
  dirId?: string
  fileId?: string
  file?: any
  publicUrl?: string
  originalHash?: string
  hardDeleted?: boolean
}

export interface StorageTestCtx extends StorageTestDeps, StorageTestOptions {
  file: File
  stamp: string
  state: StorageTestState
  /** Abort en vuelo: se pasa a upload y a los fetch (la limpieza no lo usa). */
  signal?: AbortSignal
}

const unwrap = (r: any) => r?.data ?? r

export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i) : ''
}

/** fetch sin caché HTTP (el backend sirve públicos con max-age) y con abort. Sin query params: rompería firmas. */
function noCacheFetch(c: StorageTestCtx, url: string, credentials: RequestCredentials): Promise<Response> {
  return c.fetchFn(url, { credentials, cache: 'no-store', signal: c.signal })
}

/** Para verificaciones negativas: un TypeError de red = no se pudo verificar (típico: otro origen/CORS). */
async function negativeFetch(c: StorageTestCtx, url: string, credentials: RequestCredentials): Promise<Response> {
  try {
    return await noCacheFetch(c, url, credentials)
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error('No se pudo verificar: la URL apunta a otro origen (revisa que APP_URL sea el origen del frontend).')
    }
    throw e
  }
}

const baseMime = (m?: string | null) => (m ?? '').split(';')[0].trim().toLowerCase()

async function expectFetchOk(c: StorageTestCtx, url: string, credentials: RequestCredentials): Promise<Response> {
  const res = await noCacheFetch(c, url, credentials)
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url.split('?')[0]}`)
  return res
}

async function setVisibility(c: StorageTestCtx, visibility: string) {
  const f = unwrap(await c.api.patch(`${c.filesBase}/${c.state.fileId}`, { visibility }))
  c.state.file = f
  return f
}

export function buildStorageSteps(): StepDef<StorageTestCtx>[] {
  return [
    {
      id: 'create-dir', label: 'Crear directorio de prueba',
      run: async (c) => {
        const d = unwrap(await c.api.post(c.directoriesBase, { name: `pruebas-almacenamiento-${c.stamp}` }))
        if (!d?.id) throw new Error('El backend no devolvió el id del directorio.')
        c.state.dirId = d.id
        return `Directorio "${d.name}"`
      },
    },
    {
      id: 'upload', label: 'Subir tu archivo', dependsOn: ['create-dir'],
      run: async (c) => {
        const f = unwrap(await c.upload(c.filesBase, c.file, { extraData: { directory_id: c.state.dirId, visibility: 'auth' }, signal: c.signal }))
        if (!f?.id) throw new Error('El backend no devolvió el id del archivo.')
        c.state.fileId = f.id
        c.state.file = f
        if (Number(f.size) !== c.file.size) throw new Error(`Tamaño distinto: subido ${c.file.size} B, registrado ${f.size} B.`)
        if (c.expectedDisk && f.disk !== c.expectedDisk) {
          throw new Error(`El archivo quedó en el disco "${f.disk}", se esperaba "${c.expectedDisk}".`)
        }
        return `Disco: ${f.disk ?? '?'} · ${f.size} bytes`
      },
    },
    {
      id: 'download', label: 'Descargar y verificar integridad (SHA-256)', dependsOn: ['upload'],
      run: async (c) => {
        const res = await expectFetchOk(c, c.state.file.download_url, 'include')
        const blob = await res.blob()
        c.state.originalHash ??= await c.hash(c.file)
        const h = await c.hash(blob)
        if (h !== c.state.originalHash) throw new Error(`hash distinto (${blob.size} bytes descargados de ${c.file.size}).`)
        return `SHA-256 ${h.slice(0, 12)}… coincide`
      },
    },
    {
      id: 'preview', label: 'Vista previa con URL firmada', dependsOn: ['upload'],
      run: async (c) => {
        const res = await expectFetchOk(c, c.state.file.view_url, 'include')
        const got = res.headers.get('content-type')
        const want = c.state.file.mime_type
        if (baseMime(got) === 'application/octet-stream' && baseMime(want) !== 'application/octet-stream') {
          return `200 · application/octet-stream (el backend fuerza este tipo; esperado ${baseMime(want) || 'desconocido'})`
        }
        if (want && baseMime(got) !== baseMime(want)) {
          throw new Error(`Content-Type "${got ?? 'ausente'}" no coincide con "${want}".`)
        }
        return `200 · ${got ?? 'sin content-type'}`
      },
    },
    {
      id: 'rename', label: 'Renombrar archivo', dependsOn: ['upload'],
      run: async (c) => {
        const name = `renombrado-${c.stamp}${extOf(c.file.name)}`
        const f = unwrap(await c.api.patch(`${c.filesBase}/${c.state.fileId}`, { original_name: name }))
        if (f?.original_name !== name) throw new Error(`Nombre devuelto "${f?.original_name}", se esperaba "${name}".`)
        c.state.file = f
        return `Ahora se llama "${name}"`
      },
    },
    {
      id: 'make-public', label: 'Hacer público (acceso sin sesión)', dependsOn: ['upload'],
      run: async (c) => {
        const f = await setVisibility(c, 'public')
        c.state.publicUrl = f.view_url
        try {
          await expectFetchOk(c, f.view_url, 'omit')
        } catch (e) {
          await setVisibility(c, 'auth').catch(() => {})
          throw e
        }
        return 'La URL pública responde sin sesión'
      },
    },
    {
      id: 'make-private', label: 'Volver a privado (la URL pública deja de responder)', dependsOn: ['make-public'],
      run: async (c) => {
        await setVisibility(c, 'auth')
        const res = await negativeFetch(c, c.state.publicUrl!, 'omit')
        if (res.ok) {
          throw new Error('La URL pública sigue respondiendo 200 después de pasar a privado (si hay CDN delante, puede servir la versión pública cacheada hasta 24 h).')
        }
        return `URL pública ahora responde ${res.status}`
      },
    },
    {
      id: 'share-link', label: 'Link compartido temporal (1 hora)', dependsOn: ['upload'],
      run: async (c) => {
        const { url } = await c.api.get(`${c.filesBase}/${c.state.fileId}/share-link`, { params: { hours: 1 } })
        if (!url) throw new Error('El backend no devolvió la URL.')
        await expectFetchOk(c, url, 'omit')
        return 'El link abre sin sesión'
      },
    },
    {
      id: 'grants', label: 'Dar y quitar permiso a un usuario', dependsOn: ['upload'],
      when: c => c.grants !== false,
      run: async (c) => {
        const base = `${c.filesBase}/${c.state.fileId}/grants`
        const who = c.grantee ?? {}
        await setVisibility(c, 'restricted')
        try {
          const g = unwrap(await c.api.post(base, { ...who, action: 'view' }))
          if (!g?.id) throw new Error('El backend no devolvió el id del permiso.')
          const listed = unwrap(await c.api.get(base)) ?? []
          if (!listed.some((x: any) => x.id === g?.id)) throw new Error('El permiso creado no aparece en la lista.')
          await c.api.delete(base, { params: { ...who, action: 'view' } })
          const after = unwrap(await c.api.get(base)) ?? []
          if (after.some((x: any) => x.id === g?.id)) throw new Error('El permiso sigue apareciendo después de quitarlo.')
        } finally {
          await setVisibility(c, 'auth').catch(() => {})
        }
        return 'Permiso "view" creado, listado y revocado'
      },
    },
    {
      id: 'move-root', label: 'Mover a la raíz', dependsOn: ['upload'],
      run: async (c) => {
        const f = unwrap(await c.api.patch(`${c.filesBase}/${c.state.fileId}`, { directory_id: null }))
        if (f?.directory_id) throw new Error(`Sigue en el directorio ${f.directory_id}.`)
        c.state.file = f
        return 'Movido fuera del directorio'
      },
    },
    {
      id: 'rename-dir', label: 'Renombrar directorio', dependsOn: ['create-dir'],
      run: async (c) => {
        const name = `pruebas-almacenamiento-${c.stamp}-ok`
        const d = unwrap(await c.api.patch(`${c.directoriesBase}/${c.state.dirId}`, { name }))
        if (d?.name !== name) throw new Error(`Nombre devuelto "${d?.name}".`)
        return `Ahora se llama "${name}"`
      },
    },
    {
      id: 'trash', label: 'Enviar a la papelera', dependsOn: ['upload'],
      run: async (c) => {
        await c.api.delete(`${c.filesBase}/${c.state.fileId}`)
        const f = unwrap(await c.api.get(`${c.filesBase}/${c.state.fileId}`))
        if (!f?.deleted_at) throw new Error('El archivo no quedó marcado como eliminado.')
        return 'Marcado como eliminado (en papelera)'
      },
    },
    {
      id: 'restore', label: 'Restaurar desde la papelera', dependsOn: ['trash'],
      run: async (c) => {
        const f = unwrap(await c.api.post(`${c.filesBase}/${c.state.fileId}/restore`))
        if (f?.deleted_at) throw new Error('Sigue marcado como eliminado.')
        c.state.file = f
        return 'Restaurado'
      },
    },
    {
      id: 'hard-delete', label: 'Borrado definitivo', dependsOn: ['upload'],
      run: async (c) => {
        const oldUrl = c.state.file.download_url
        await c.api.delete(`${c.filesBase}/${c.state.fileId}`, { params: { force: 1 } })
        c.state.hardDeleted = true
        let stillThere = false
        try {
          await c.api.get(`${c.filesBase}/${c.state.fileId}`)
          stillThere = true
        } catch (e: any) {
          if (e?.status !== 404) throw e
        }
        if (stillThere) throw new Error('El archivo sigue existiendo después del borrado definitivo.')
        const res = await negativeFetch(c, oldUrl, 'include')
        if (res.ok) throw new Error('La URL de descarga sigue entregando el archivo.')
        return `Eliminado (descarga ahora responde ${res.status})`
      },
    },
    {
      id: 'cleanup', label: 'Limpieza', always: true,
      run: async (c) => {
        const problems: string[] = []
        if (c.state.fileId && !c.state.hardDeleted) {
          await c.api.patch(`${c.filesBase}/${c.state.fileId}`, { visibility: 'auth' }).catch(() => {})
          await c.api.delete(`${c.filesBase}/${c.state.fileId}`, { params: { force: 1 } })
            .catch((e: any) => problems.push(`archivo: ${e?.data?.message ?? e?.message}`))
        }
        if (c.state.dirId) {
          await c.api.delete(`${c.directoriesBase}/${c.state.dirId}`, { params: { force: 1, cascade: 1 } })
            .catch((e: any) => problems.push(`directorio: ${e?.data?.message ?? e?.message}`))
        }
        if (problems.length) throw new Error(`Quedaron residuos — ${problems.join('; ')}`)
        return 'Sin residuos'
      },
    },
  ]
}
