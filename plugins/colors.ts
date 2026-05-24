import type { ColorOption, ColorScale } from '../app.config'

const SCALE_LEVELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/**
 * Aplica las CSS vars `--primary-{50..950}` y `--secondary-{50..950}` desde
 * `appConfig.innertia.colors`. Funciona en SSR (inyecta <style> en head) y cliente.
 *
 * Acepta:
 *   - Nombre Tailwind: 'violet' → mapea a var(--color-violet-50..950)
 *   - Scale custom: { 50: '#f5f3ff', ..., 950: '#2e1065' }
 *
 * También deriva las vars semánticas `--primary`, `--primary-hover`, `--primary-foreground`,
 * etc., usando el nivel 600 (default) o el más cercano en una scale custom.
 */
export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig()
  const colors = appConfig.innertia?.colors as { primary?: ColorOption; secondary?: ColorOption } | undefined
  if (!colors) return

  const css = buildColorCSS(colors)
  if (!css) return

  useHead({
    style: [
      {
        // Marcamos como innertia para poder identificarla en debug
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
