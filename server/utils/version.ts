// Lógica pura del endpoint de versiones (sin h3, testeable aislada).

export interface VersionConfig {
  app?: string
  version?: string
  commit?: string
  buildDate?: string
  packages?: Record<string, string>
  detailsPath?: string
}

export interface PublicVersion {
  app: string | null
  version: string | null
  commit: string | null
  build_date: string | null
  environment: string
}

const orNull = (v?: string) => (v && v.trim() ? v.trim() : null)

/** Público: SOLO estos 5 campos. Nunca dependencias ni runtime (fingerprinting/CVE). */
export function publicVersion(cfg: VersionConfig, env: Record<string, string | undefined>): PublicVersion {
  const commit = orNull(cfg.commit)
  return {
    app: orNull(cfg.app),
    version: orNull(cfg.version),
    commit: commit ? commit.slice(0, 7) : null,
    build_date: orNull(cfg.buildDate),
    environment: env.APP_ENV || env.NODE_ENV || 'production',
  }
}

/** Detalle del front: público + runtime + paquetes. Solo tras autorizar contra el backend. */
export function frontendDetails(cfg: VersionConfig, env: Record<string, string | undefined>, node: string) {
  return {
    ...publicVersion(cfg, env),
    runtime: { node },
    packages: { ...(cfg.packages ?? {}) },
  }
}
