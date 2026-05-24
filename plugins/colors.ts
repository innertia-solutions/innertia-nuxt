import type { ColorOption, ColorScale, PrelineTheme } from '../app.config'

const SCALE_LEVELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/**
 * Aplica el theming completo desde `appConfig.innertia`:
 *   - `theme`             → setea `data-theme="theme-{name}"` en <html> (Preline themes)
 *   - `colors.primary`    → override del brand color del tema → --primary-{50..950}
 *   - `colors.secondary`  → --secondary-{50..950}
 *
 * Funciona en SSR (inyecta <style> + htmlAttrs en head) y cliente.
 *
 * `colors.primary/secondary` acepta:
 *   - Nombre Tailwind: 'violet' → mapea a var(--color-violet-50..950)
 *   - Scale custom: { 50: '#f5f3ff', ..., 950: '#2e1065' }
 *
 * El "tono dark" se controla via `theme` — cada tema Preline incluye su propia
 * paleta neutral para light y dark. Ej. `theme: 'moon'` da un dark grisáceo elegante.
 */
export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig()
  const theme = appConfig.innertia?.theme as PrelineTheme | undefined
  const colors = appConfig.innertia?.colors as { primary?: ColorOption; secondary?: ColorOption } | undefined

  // ── Aplicar tema Preline via data-theme ─────────────────────────────────
  if (theme && theme !== 'default') {
    useHead({ htmlAttrs: { 'data-theme': `theme-${theme}` } })
  }

  // ── Aplicar overrides de primary/secondary via <style> ───────────────────
  if (!colors || (!colors.primary && !colors.secondary)) return
  const css = buildColorCSS(colors)
  if (!css) return

  useHead({
    style: [
      {
        id: 'innertia-colors',
        children: css,
      },
    ],
  })
})

function buildColorCSS(colors: { primary?: ColorOption; secondary?: ColorOption }): string {
  const lines: string[] = [':root {']

  if (colors.primary !== undefined) {
    lines.push(...buildRoleVars('primary', colors.primary))
  }
  if (colors.secondary !== undefined) {
    lines.push(...buildRoleVars('secondary', colors.secondary))
  }

  lines.push('}')
  return lines.join('\n')
}

function buildRoleVars(role: 'primary' | 'secondary', value: ColorOption): string[] {
  const out: string[] = []

  if (typeof value === 'string') {
    // Tailwind color name → referenciar las vars que Tailwind ya define
    const tone = value
    for (const lvl of SCALE_LEVELS) {
      out.push(`  --${role}-${lvl}: var(--color-${tone}-${lvl});`)
    }
    // Semantic tokens — niveles default 600 (base), 700 (hover/focus/active)
    out.push(`  --${role}: var(--color-${tone}-600);`)
    out.push(`  --${role}-hover: var(--color-${tone}-700);`)
    out.push(`  --${role}-focus: var(--color-${tone}-700);`)
    out.push(`  --${role}-active: var(--color-${tone}-800);`)
    out.push(`  --${role}-checked: var(--color-${tone}-600);`)
    out.push(`  --${role}-foreground: #ffffff;`)
  } else {
    // Scale custom — usar los valores explícitos
    const scale = value as ColorScale
    for (const lvl of SCALE_LEVELS) {
      const hex = scale[lvl]
      if (hex) out.push(`  --${role}-${lvl}: ${hex};`)
    }
    if (scale[600]) out.push(`  --${role}: ${scale[600]};`)
    if (scale[700]) out.push(`  --${role}-hover: ${scale[700]};`)
    if (scale[700]) out.push(`  --${role}-focus: ${scale[700]};`)
    if (scale[800]) out.push(`  --${role}-active: ${scale[800]};`)
    if (scale[600]) out.push(`  --${role}-checked: ${scale[600]};`)
    out.push(`  --${role}-foreground: #ffffff;`)
  }

  return out
}
