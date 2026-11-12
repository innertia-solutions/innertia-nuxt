import { resolveSessionToken, persistRotatedSession } from '../utils/sessionToken'

// Lee la sesión sellada una vez por request y deja el token en event.context
// para que useApi (SSR) adjunte el Bearer en llamadas directas a Laravel.
// Si al token le queda poco, lo renueva (renovación deslizante): una sesión con
// uso activo ya no expira a los 60 min fijos del JWT.
// Defensivo: si no hay secret/sesión, sigue sin token (no revienta el request).
export default defineEventHandler(async (event) => {
  const path = event.path || ''
  // Las rutas /_auth/** escriben/borran la sesión por su cuenta (login, logout,
  // contexto): no se mezclan con una renovación. Los assets no necesitan sesión.
  if (path.startsWith('/_auth/') || path.startsWith('/_nuxt/') || path.startsWith('/_version')) return
  try {
    const token = await resolveSessionToken(event)
    if (token) event.context.authToken = token
    // El BFF (/api/**) escribe la cookie renovada después de copiar los headers de
    // Laravel (que pisarían el Set-Cookie); el resto (SSR de páginas), acá.
    if (!path.startsWith('/api/')) await persistRotatedSession(event)
  } catch {
    // sin NUXT_SESSION_PASSWORD o sin sesión válida → seguir sin token
  }
})
