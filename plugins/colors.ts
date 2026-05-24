import type { ColorOption, ColorScale, DarkTone } from '../app.config'

const SCALE_LEVELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/**
 * Aplica las CSS vars de theming desde `appConfig.innertia`:
 *   - `colors.primary` y `colors.secondary` → --primary-{50..950}, --secondary-{50..950}
 *   - `darkTone` → reemplaza el neutral default en modo dark (backgrounds, borders, surfaces)
 *
 * Funciona en SSR (inyecta <style> en head) y cliente.
 *
 * colors acepta:
 *   - Nombre Tailwind: 'violet' → mapea a var(--color-violet-50..950)
 *   - Scale custom: { 50: '#f5f3ff', ..., 950: '#2e1065' }
 *
 * darkTone acepta:
 *   'neutral' | 'slate' | 'gray' | 'zinc' | 'stone'
 */
export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig()
  const colors = appConfig.innertia?.colors as { primary?: ColorOption; secondary?: ColorOption } | undefined
  const darkTone = appConfig.innertia?.darkTone as DarkTone | undefined

  const css: string[] = []

  if (colors) css.push(buildColorCSS(colors))
  // Solo aplicar override si el producto eligió algo distinto del default
  if (darkTone && darkTone !== 'neutral') css.push(buildDarkToneCSS(darkTone))

  if (css.length === 0) return

  useHead({
    style: [
      {
        id: 'innertia-colors',
        children: css.join('\n'),
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

/**
 * Genera overrides para modo dark reemplazando el `neutral` default por el tono elegido.
 * Cubre backgrounds, foregrounds, borders, layers, surfaces y cards — todos los lugares
 * donde el theme.css base usa `--color-neutral-*` en `.dark`.
 *
 * Por especificidad, `.dark` aquí gana sobre `.dark` en theme.css porque se inyecta
 * después en el head (last-declared wins).
 */
function buildDarkToneCSS(tone: DarkTone): string {
  return `.dark {
  --background: var(--color-${tone}-800);
  --background-1: var(--color-${tone}-900);
  --background-2: var(--color-${tone}-900);
  --background-plain: var(--color-${tone}-950);
  --foreground: var(--color-${tone}-200);
  --foreground-inverse: var(--color-white);
  --inverse: var(--color-${tone}-950);
  --border: var(--color-${tone}-700);
  --border-line-1: var(--color-${tone}-800);
  --border-line-2: var(--color-${tone}-700);
  --border-line-3: var(--color-${tone}-600);
  --layer: var(--color-${tone}-800);
  --layer-line: var(--color-${tone}-700);
  --layer-hover: var(--color-${tone}-700);
  --layer-focus: var(--color-${tone}-700);
  --layer-active: var(--color-${tone}-700);
  --surface: var(--color-${tone}-700);
  --surface-1: var(--color-${tone}-600);
  --surface-2: var(--color-${tone}-500);
  --surface-3: var(--color-${tone}-600);
  --muted: var(--color-${tone}-700);
  --muted-foreground: var(--color-${tone}-400);
  --muted-foreground-1: var(--color-${tone}-300);
  --muted-hover: var(--color-${tone}-600);
  --card: var(--color-${tone}-800);
  --card-line: var(--color-${tone}-700);
  --card-divider: var(--color-${tone}-700);
  --card-header: var(--color-${tone}-700);
  --card-footer: var(--color-${tone}-700);
  --dropdown: var(--color-${tone}-800);
  --dropdown-line: var(--color-${tone}-700);
  --dropdown-divider: var(--color-${tone}-700);
  --dropdown-item-hover: var(--color-${tone}-700);
  --dropdown-item-foreground: var(--color-${tone}-200);
  --tooltip: var(--color-${tone}-100);
  --tooltip-foreground: var(--color-${tone}-900);
  --navbar: var(--color-${tone}-900);
  --navbar-line: var(--color-${tone}-800);
  --navbar-divider: var(--color-${tone}-800);
  --navbar-nav-foreground: var(--color-${tone}-300);
  --navbar-nav-hover: var(--color-${tone}-800);
  --navbar-nav-active: var(--color-${tone}-700);
  --sidebar: var(--color-${tone}-900);
  --sidebar-line: var(--color-${tone}-800);
}`
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
