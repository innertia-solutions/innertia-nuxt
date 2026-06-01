import { CHILE } from './geo/chile'

// Catálogo geográfico de Chile (país/regiones/comunas) con códigos CUT.
// Misma data y keys que innertia-laravel (Innertia\Geo\Geo). Sin fetch.
export function useGeo() {
  const regions = () => CHILE.regions.map(r => ({ code: r.code, name: r.name }))

  const communes = (regionCode) => {
    const r = CHILE.regions.find(r => r.code === regionCode)
    return r ? r.communes.map(c => ({ code: c.code, name: c.name })) : []
  }

  const regionName = (code) => CHILE.regions.find(r => r.code === code)?.name ?? null

  const communeName = (code) => {
    for (const r of CHILE.regions) {
      const c = r.communes.find(c => c.code === code)
      if (c) return c.name
    }
    return null
  }

  return { regions, communes, regionName, communeName }
}
