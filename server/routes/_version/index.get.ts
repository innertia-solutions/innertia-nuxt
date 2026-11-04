import { defineEventHandler, setResponseHeader } from 'h3'
import { publicVersion } from '../../utils/version'

// Público: qué build del front está desplegado. Sin dependencias.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  return publicVersion(useRuntimeConfig(event).innertiaVersion ?? {}, process.env)
})
