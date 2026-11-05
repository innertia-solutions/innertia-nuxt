/**
 * Motor genérico de pasos de prueba: corre StepDef en orden, respeta dependencias
 * (si una dependencia no quedó 'ok' → 'skipped'), `when` (desactivado), `always`
 * (corre siempre, p. ej. limpieza) y abort. Emite un snapshot por cambio de estado.
 */
export type StepStatus = 'pending' | 'running' | 'ok' | 'failed' | 'skipped'

export interface StepResult {
  id: string
  label: string
  status: StepStatus
  ms?: number
  detail?: string
}

export interface StepDef<C> {
  id: string
  label: string
  dependsOn?: string[]
  /** Corre aunque fallen dependencias o se haya abortado (limpieza). */
  always?: boolean
  /** false → 'skipped' con detalle 'Desactivado'. */
  when?: (ctx: C) => boolean
  /** Devuelve un detalle opcional; lanzar = fallo. */
  run: (ctx: C) => Promise<string | void>
}

export function describeError(e: any): string {
  if (e?.status) return `HTTP ${e.status}: ${e?.data?.message ?? e?.message ?? 'error'}`
  return e?.message ?? String(e)
}

export async function runSteps<C>(
  defs: StepDef<C>[],
  ctx: C,
  onUpdate: (results: StepResult[]) => void,
  signal?: AbortSignal,
): Promise<StepResult[]> {
  const results: StepResult[] = defs.map(d => ({ id: d.id, label: d.label, status: 'pending' }))
  const byId = Object.fromEntries(results.map(r => [r.id, r]))
  const emit = () => onUpdate(results.map(r => ({ ...r })))
  emit()

  for (const def of defs) {
    const r = byId[def.id]

    if (def.when && !def.when(ctx)) {
      Object.assign(r, { status: 'skipped', detail: 'Desactivado' })
      emit()
      continue
    }
    if (!def.always) {
      if (signal?.aborted) {
        Object.assign(r, { status: 'skipped', detail: 'Cancelado' })
        emit()
        continue
      }
      const blocked = (def.dependsOn ?? []).find(dep => byId[dep]?.status !== 'ok')
      if (blocked) {
        Object.assign(r, { status: 'skipped', detail: `Depende de: ${byId[blocked]?.label ?? blocked}` })
        emit()
        continue
      }
    }

    r.status = 'running'
    emit()
    const t0 = Date.now()
    try {
      const detail = await def.run(ctx)
      r.status = 'ok'
      if (detail) r.detail = detail
    } catch (e) {
      r.status = 'failed'
      r.detail = describeError(e)
    }
    r.ms = Date.now() - t0
    emit()
  }

  return results
}
