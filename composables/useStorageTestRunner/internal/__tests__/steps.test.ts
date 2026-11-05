import { describe, it, expect } from 'vitest'
import { runSteps } from '../engine'
import { buildStorageSteps, sha256Hex, type StorageTestCtx } from '../steps'

type Opts = { disk?: string, corrupt?: boolean, leakPublic?: boolean, grantNoId?: boolean, trashListThrows?: boolean }

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
  const patches: { id: string, body: any }[] = []
  const fetchInits: any[] = []
  const ops: string[] = []

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
        if (opts.trashListThrows) throw new Error('la lista de papelera no debe usarse')
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
        fileOr404(m[1]); const g: any = { id: opts.grantNoId ? undefined : nextId(), action: body.action }
        grants.set(m[1], [...(grants.get(m[1]) ?? []), g]); return { data: g }
      }
      throw httpError(404)
    },
    async patch(path: string, body: any = {}) {
      let m
      if ((m = path.match(/^dirs\/(\w+)$/))) { const d = dirs.get(m[1]); Object.assign(d, body); return { data: d } }
      if ((m = path.match(/^files\/(\w+)$/))) { const f = fileOr404(m[1]); patches.push({ id: m[1], body }); Object.assign(f, body); return { data: present(f) } }
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
        ops.push(o.params?.force ? `force:${m[1]}` : `soft:${m[1]}`)
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

  async function fetchFn(url: string, init?: any) {
    fetchInits.push(init)
    const m = url.match(/^\/files\/(\w+)\/(view|download)(\?signature=\w+)?$/)
    const f = m && files.get(m[1])
    if (!m || !f) return new Response('', { status: 404 })
    const signed = !!m[3]
    if (!signed && f.visibility !== 'public' && !opts.leakPublic) return new Response('', { status: 403 })
    return new Response(blobs.get(f.id)!, { status: 200, headers: { 'content-type': f.mime_type } })
  }

  return { api, upload, fetchFn, dirs, files, patches, fetchInits, ops }
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

  it('C1: todos los fetch van con cache no-store', async () => {
    const be = fakeBackend()
    await run(ctxFor(be))
    expect(be.fetchInits.length).toBeGreaterThan(4)
    expect(be.fetchInits.every(i => i?.cache === 'no-store')).toBe(true)
  })

  it('I2: un permiso devuelto sin id hace fallar grants', async () => {
    const res = await run(ctxFor(fakeBackend({ grantNoId: true })))
    const g = res.find(r => r.id === 'grants')!
    expect(g.status).toBe('failed')
    expect(g.detail).toContain('id del permiso')
  })

  it('M1: la papelera se verifica por GET del archivo, no por la lista', async () => {
    const res = await run(ctxFor(fakeBackend({ trashListThrows: true })))
    expect(res.find(r => r.id === 'trash')!.status).toBe('ok')
  })

  it('M2: TypeError de red en check negativo da error claro', async () => {
    const be = fakeBackend()
    const orig = be.fetchFn
    let calls = 0
    const ctx = ctxFor(be, { fetchFn: (async (u: string, i: any) => {
      if (u.endsWith('/view') && ++calls > 0) throw new TypeError('Failed to fetch')
      return orig(u, i)
    }) as any })
    const res = await run(ctx)
    const mp = res.find(r => r.id === 'make-public')!
    expect(mp.status).toBe('failed') // make-public usa expectFetchOk (positivo)
    const hd = res.find(r => r.id === 'hard-delete')!
    expect(hd.status).toBe('ok')
  })

  it('M3: la limpieza intenta volver a privado y luego borra con force', async () => {
    const be = fakeBackend()
    let failedOnce = false
    const api = { ...be.api, delete: async (path: string, o: any = {}) => {
      if (o.params?.force && /^files\/\w+$/.test(path) && !failedOnce) { failedOnce = true; throw httpError(500, 'boom') }
      return be.api.delete(path, o)
    } }
    const res = await run(ctxFor(be, { api }))
    expect(res.find(r => r.id === 'hard-delete')!.status).toBe('failed')
    expect(res.find(r => r.id === 'cleanup')!.status).toBe('ok')
    expect(be.patches.at(-1)!.body).toEqual({ visibility: 'auth' })
    expect(be.ops.at(-1)).toMatch(/^force:/)
  })

  it('M4: content-type distinto falla la vista previa; octet-stream pasa con nota', async () => {
    const be = fakeBackend()
    const bad = await run(ctxFor(be, { fetchFn: (async (u: string, i: any) => {
      const r = await be.fetchFn(u, i); return u.includes('/view') && r.ok ? new Response(await r.blob(), { headers: { 'content-type': 'image/png' } }) : r
    }) as any }))
    expect(bad.find(r => r.id === 'preview')!.status).toBe('failed')
    const be2 = fakeBackend()
    const ok = await run(ctxFor(be2, { fetchFn: (async (u: string, i: any) => {
      const r = await be2.fetchFn(u, i); return u.includes('/view') && r.ok ? new Response(await r.blob(), { headers: { 'content-type': 'application/octet-stream' } }) : r
    }) as any }))
    const p = ok.find(r => r.id === 'preview')!
    expect(p.status).toBe('ok')
    expect(p.detail).toContain('octet-stream')
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
