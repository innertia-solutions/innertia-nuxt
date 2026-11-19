import { describe, it, expect } from 'vitest'
import { resolveBrandingPreview, validateBranding } from '../mailBranding'

const platform = { name: 'pomely', logo_url: 'https://cdn.test/pomely.png', color: '#112233' }

describe('vista previa de marca', () => {
  it('sin marca del espacio usa la de plataforma (sin "vía")', () => {
    expect(resolveBrandingPreview({}, platform)).toEqual({
      name: 'pomely', logo_url: 'https://cdn.test/pomely.png', color: '#112233', footer_address: null, footer_phone: null, via: null,
    })
  })

  it('marca propia con respaldo campo a campo y pie "vía"', () => {
    const r = resolveBrandingPreview({ display_name: 'CESFAM Rancagua', footer_phone: '+56 72 123' }, platform)
    expect(r.name).toBe('CESFAM Rancagua')
    expect(r.logo_url).toBeNull()        // marca propia sin logo: el nombre en texto, no el logo de plataforma
    expect(r.color).toBe('#112233')
    expect(r.footer_phone).toBe('+56 72 123')
    expect(r.via).toBe('pomely')
  })

  it('ignora color o URL inválidos', () => {
    const r = resolveBrandingPreview({ color: 'rojo', logo_url: 'ftp://x' }, platform)
    expect(r.color).toBe('#112233')
    expect(r.logo_url).toBe('https://cdn.test/pomely.png')
  })

  it('valida los campos', () => {
    expect(validateBranding({ color: '#zzz', logo_url: 'logo.png' })).toMatchObject({
      color: 'El color debe ser un hexadecimal como #6366f1 o #fff.',
      logo_url: 'La URL del logo debe comenzar con http:// o https://.',
    })
    expect(validateBranding({ color: '#fff', logo_url: 'https://x.cl/l.png' })).toMatchObject({ color: null, logo_url: null })
  })
})
