// Build-time (Node): recolecta la info de versión del PRODUCTO al correr `nuxi build`.
// La usa el módulo inline del nuxt.config de la capa para llenar
// runtimeConfig.innertiaVersion (PRIVADO: nunca llega al payload del browser).
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

export const DEFAULT_FRONT_PACKAGES = [
  'nuxt',
  'vue',
  '@innertia-solutions/innertia-nuxt',
  'pinia',
  '@pinia/nuxt',
  '@tanstack/vue-query',
  'tailwindcss',
  'pusher-js',
]

export interface BuildVersion {
  app: string
  version: string
  commit: string
  buildDate: string
  packages: Record<string, string>
}

function readJson(path: string): Record<string, any> | null {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
  } catch {
    return null
  }
}

/** Versiones instaladas (node_modules del producto). Las ausentes se omiten. */
export function readPackageVersions(rootDir: string, names: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of names) {
    const v = readJson(join(rootDir, 'node_modules', name, 'package.json'))?.version
    if (typeof v === 'string' && v) out[name] = v
  }
  return out
}

function gitCommit(rootDir: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 })
      .toString().trim()
  } catch {
    return ''
  }
}

/**
 * Prioridad por campo: env de build (APP_COMMIT / APP_BUILD_DATE / APP_VERSION)
 * → build-info.json en rootDir (lo escribe el Dockerfile) → fallback
 * (git rev-parse en dev, package.json del producto, fecha actual).
 */
export function collectBuildVersion(
  rootDir: string,
  env: Record<string, string | undefined> = process.env,
  opts: { git?: boolean, packages?: string[] } = {},
): BuildVersion {
  const product = readJson(join(rootDir, 'package.json')) ?? {}
  const info = readJson(join(rootDir, 'build-info.json')) ?? {}
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  return {
    app: str(product.name),
    version: str(env.APP_VERSION) || str(info.version) || str(product.version),
    commit: str(env.APP_COMMIT) || str(info.commit) || (opts.git === false ? '' : gitCommit(rootDir)),
    buildDate: str(env.APP_BUILD_DATE) || str(info.build_date) || new Date().toISOString(),
    packages: readPackageVersions(rootDir, opts.packages ?? DEFAULT_FRONT_PACKAGES),
  }
}
