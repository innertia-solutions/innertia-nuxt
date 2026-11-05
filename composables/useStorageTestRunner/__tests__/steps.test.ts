import { describe, it, expect } from 'vitest'
import { runSteps } from '../engine'
import { buildStorageSteps, sha256Hex, type StorageTestCtx } from '../steps'

type Opts = { disk?: string, corrupt?: boolean, leakPublic?: boolean }

function httpError(status: number, message = 'error') {
  return Object.assign(new Error(`API error ${status}`), { status, data: { message } })
}

function fakeBackend(opts: Opts = {}) {
  let n = 0
  const nextId = () => `id${++n}`
  const dirs = new Map<string, any>()
  const files = new Map<string, any>()
  const blobs = new Map<string, Blob>()
  const grants = new Map<string, any[]>()

  const present = (f: any) => {
    const pub = f.visibility === 'public'
    return {
      ...f,
      view_url: pub ? `/files/${f.id}/view` : `/files/${f.id}/view?signature=s`,
      download_url: pub ? `/files/${f.id}/download` : `/files/${f.id}/download?signature=s`,
    }
  }
  const fileOr404 = (id: string) => { const f = files.get(id); if (!f) throw httpError(404, 'File not found.'); return f }

  const api = {
    async get(path: string, o: any = {}) {
      let m
      if ((m = path.match(/^files\/trash$/))) {
        const q = o.params?.search ?? ''
        return { data: [...files.values()].filter(f => f.deleted_at && f.original_name.includes(q)).map(present) }
      }
      if ((m = path.match(/^files\/(\w+)\/share-link$/))) { fileOr404(m[1]); return { url: `/files/${m[1]}/view?signature=share`, expires_in_hours: 1 } }
      if ((m = path.match(/^files\/(\w+)\/grants$/))) { fileOr404(m[1]); return { data: grants.get(m[1]) ?? [] } }
      if ((m = path.match(/^files\/(\w+)$/))) return { data: present(fileOr404(m[1])) }
      throw httpError(404)
    },
    async post(path: string, body: any = {}) {
      let m
      if (path === 'dirs') { const d = { id: nextId(), name: body.name }; dirs.set(d.id, d); return { data: d } }
      if ((m = path.match(/^files\/(\w+)\/restore$/))) { const f = fileOr404(m[1]); f.deleted_at = null; return { data: present(f) } }
      if ((m = path.match(/^files\/(\w+)\/grants$/))) {
        fileOr404(m[1]); const g = { id: nextId(), action: body.action }
        grants.set(m[1], [...(grants.get(m[1]) ?? []), g]); return { data: g }
      }
      throw httpError(404)
    },
    async patch(path: string, body: any = {}) {
      let m
      if ((m = path.match(/^dirs\/(\w+)$/))) { const d = dirs.get(m[1]); Object.assign(d, body); return { data: d } }
      if ((m = path.match(/^files\/(\w+)$/))) { const f = fileOr404(m[1]); Object.assign(f, body); return { data: present(f) } }
      throw httpError(404)
    },
    async delete(path: string, o: any = {}) {
      let m
      if ((m = path.match(/^dirs\/(\w+)$/))) {
        dirs.delete(m[1])
        for (const f of [...files.values()]) if (f.directory_id === m[1]) { files.delete(f.id); blobs.delete(f.id) }
        return ''
      }
      if ((m = path.match(/^files\/(\w+)\/grants$/))) {
        grants.set(m[1], (grants.get(m[1]) ?? []).filter(g => g.action !== o.params?.action)); return ''
      }
      if ((m = path.match(/^files\/(\w+)$/))) {
        const f = fileOr404(m[1])
        if (o.params?.force) { files.delete(f.id); blobs.delete(f.id) } else f.deleted_at = '2026-11-04T00:00:00Z'
        return ''
      }
      throw httpError(404)
    },
  }

  async function upload(endpoint: string, file: File, o: any = {}) {
    if (endpoint !== 'files') throw httpError(404)
    const f = {
      id: nextId(), original_name: file.name, size: file.size, mime_type: file.type,
      disk: opts.disk ?? 'cloud', visibility: o.extraData?.visibility ?? 'auth',
      directory_id: o.extraData?.directory_id ?? null, deleted_at: null,
    }
    files.set(f.id, f)
    blobs.set(f.id, opts.corrupt ? new Blob(['corrupto']) : file)
    return { data: present(f) }
  }

  async function fetchFn(url: string) {
    const m = url.match(/^\/files\/(\w+)\/(view|download)(\?signature=\w+)?$/)
    const f = m && files.get(m[1])
    if (!m || !f) return new Response('', { status: 404 })
    const signed = !!m[3]
    if (!signed && f.visibility !== 'public' && !opts.leakPublic) return new Response('', { status: 403 })
    return new Response(blobs.get(f.id)!, { status: 200, headers: { 'content-type': f.mime_type } })
  }

  return { api, upload, fetchFn, dirs, files }
}

function ctxFor(be: ReturnType<typeof fakeBackend>, over: Partial<StorageTestCtx> = {}): StorageTestCtx {
  return {
    api: be.api, upload: be.upload, fetchFn: be.fetchFn as any, hash: sha256Hex,
    filesBase: 'files', directoriesBase: 'dirs', expectedDisk: 'cloud', grants: true,
    file: new File(['hola mundo'], 'prueba.txt', { type: 'text/plain' }),
    stamp: 'abc', state: {}, ...over,
  }
}

const run = (ctx: StorageTestCtx) => runSteps(buildStorageSteps(), ctx, () => {})

describe('buildStorageSteps', () => {
  it('camino feliz: 15/15 ok y sin residuos', async () => {
    const be = fakeBackend()
    const res = await run(ctxFor(be))
    expect(res).toHaveLength(15)
    expect(res.filter(r => r.status !== 'ok')).toEqual([])
    expect(be.files.size).toBe(0)
    expect(be.dirs.size).toBe(0)
  })

  it('disco inesperado: falla la subida, dependientes omitidos, limpieza corre', async () => {
    const be = fakeBackend({ disk: 'local' })
    const res = await run(ctxFor(be))
    const byId = Object.fromEntries(res.map(r => [r.id, r]))
    expect(byId.upload.status).toBe('failed')
    expect(byId.upload.detail).toContain('"local"')
    expect(byId.download.status).toBe('skipped')
    expect(byId.cleanup.status).toBe('ok')
    expect(be.files.size).toBe(0)
    expect(be.dirs.size).toBe(0)
  })

  it('sin expectedDisk no valida el disco', async () => {
    const be = fakeBackend({ disk: 'local' })
    const res = await run(ctxFor(be, { expectedDisk: null }))
    expect(res.find(r => r.id === 'upload')!.status).toBe('ok')
  })

  it('descarga corrupta: falla la integridad', async () => {
    const res = await run(ctxFor(fakeBackend({ corrupt: true })))
    const dl = res.find(r => r.id === 'download')!
    expect(dl.status).toBe('failed')
    expect(dl.detail).toContain('hash distinto')
  })

  it('URL pública que sigue respondiendo tras volver a privado: falla make-private', async () => {
    const res = await run(ctxFor(fakeBackend({ leakPublic: true })))
    expect(res.find(r => r.id === 'make-private')!.status).toBe('failed')
  })

  it('grants=false: paso de permisos desactivado', async () => {
    const res = await run(ctxFor(fakeBackend(), { grants: false }))
    expect(res.find(r => r.id === 'grants')).toMatchObject({ status: 'skipped', detail: 'Desactivado' })
  })
})

describe('sha256Hex', () => {
  it('hash hex de 64 chars, estable', async () => {
    const a = await sha256Hex(new Blob(['x']))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await sha256Hex(new Blob(['x']))).toBe(a)
  })
})
