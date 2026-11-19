// Vista previa de la marca de correos (espejo de \Innertia\Mail\Branding::for()):
// marca del espacio con respaldo campo a campo en la de plataforma y "vía" cuando hay marca propia.

export interface BrandingFields {
  display_name?: string | null
  logo_url?: string | null
  color?: string | null
  footer_address?: string | null
  footer_phone?: string | null
}

export interface ResolvedBranding {
  name: string
  logo_url: string | null
  color: string
  footer_address: string | null
  footer_phone: string | null
  via: string | null
}

export const DEFAULT_BRAND_COLOR = '#6366f1'
export const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const HTTP_URL = /^https?:\/\//i

const clean = (v?: string | null) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

export function resolveBrandingPreview(tenant: BrandingFields | null | undefined, platform: Partial<ResolvedBranding> | null | undefined): ResolvedBranding {
  const p: ResolvedBranding = {
    name: clean(platform?.name) ?? 'App',
    logo_url: clean(platform?.logo_url),
    color: clean(platform?.color) ?? DEFAULT_BRAND_COLOR,
    footer_address: null,
    footer_phone: null,
    via: null,
  }

  const name = clean(tenant?.display_name)
  const logoRaw = clean(tenant?.logo_url)
  const logo = logoRaw && HTTP_URL.test(logoRaw) ? logoRaw : null
  const color = clean(tenant?.color)
  const own = name !== null || logo !== null

  return {
    name: name ?? p.name,
    logo_url: logo ?? (own ? null : p.logo_url),
    color: color && HEX_COLOR.test(color) ? color : p.color,
    footer_address: clean(tenant?.footer_address),
    footer_phone: clean(tenant?.footer_phone),
    via: own && name !== p.name ? p.name : null,
  }
}

/** Errores de validación local de los campos de marca (null = válido). */
export function validateBranding(fields: BrandingFields): Record<string, string | null> {
  const logo = clean(fields.logo_url)
  const color = clean(fields.color)
  return {
    logo_url: logo && !HTTP_URL.test(logo) ? 'La URL del logo debe comenzar con http:// o https://.' : null,
    color: color && !HEX_COLOR.test(color) ? 'El color debe ser un hexadecimal como #6366f1 o #fff.' : null,
    display_name: (fields.display_name ?? '').length > 120 ? 'Máximo 120 caracteres.' : null,
  }
}
