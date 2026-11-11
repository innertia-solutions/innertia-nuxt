// Formato estándar de versión de despliegue (espejo de Innertia\Version\VersionString):
//   prod v1.0.2-20261111.2 · QA v1.0.2-20261111-QA.7 · dev v1.0.2-dev

export interface VersionParts {
  raw: string
  semver: string
  date: string | null
  environment: 'production' | 'qa' | 'dev'
  sequence: number | null
}

const PATTERN = /^v(\d+\.\d+\.\d+)-(?:(\d{8})(?:-(QA))?\.(\d+)|(dev))$/

export function parseVersion(raw?: string | null): VersionParts | null {
  const value = (raw ?? '').trim()
  const m = PATTERN.exec(value)
  if (!m) return null
  if (m[5] === 'dev') return { raw: value, semver: m[1], date: null, environment: 'dev', sequence: null }
  return {
    raw: value,
    semver: m[1],
    date: `${m[2].slice(0, 4)}-${m[2].slice(4, 6)}-${m[2].slice(6, 8)}`,
    environment: m[3] === 'QA' ? 'qa' : 'production',
    sequence: Number(m[4]),
  }
}

/** Etiqueta corta para UI: "v1.0.2 · QA #7" | "v1.0.2 · #2" | "v1.0.2 · dev" | crudo. */
export function versionLabel(raw?: string | null): string {
  const p = parseVersion(raw)
  if (!p) return (raw ?? '').trim()
  if (p.environment === 'dev') return `v${p.semver} · dev`
  return `v${p.semver} · ${p.environment === 'qa' ? 'QA ' : ''}#${p.sequence}`
}
