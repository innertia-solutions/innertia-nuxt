/**
 * Middleware global que se ejecuta en cada navegación.
 *
 * Lee la declaración de apps desde `appConfig.innertia.apps`. Si el producto
 * no declara apps, este middleware no hace nada (feature inactivo).
 *
 * Cuando hay apps declaradas, resuelve qué "app" (contexto) está intentando
 * acceder el usuario según el prefijo de URL y:
 *   1. Si la URL no cae en ningún app declarado → pasa (deja seguir)
 *   2. Si la URL es la ruta de login del app → pasa (sin chequeo de permisos)
 *   3. Si el usuario no está autenticado → deja que el middleware `auth` redirija
 *   4. Si `availableContexts` está vacío (SSR sin hidratar) → intenta fetchMe()
 *      y si falla, pasa sin redirigir (mejor renderizar que redirigir mal)
 *   5. Si el usuario está autenticado pero NO tiene acceso al contexto del app →
 *      redirige al primer app accesible (o a su loginPath si no tiene ninguno)
 *   6. Si todo OK pero `currentContext !== app.context` → sincroniza el contexto
 *      en el authStore y recarga permisos vía fetchMe()
 *
 * Esto es lo que permite el "cambio de contexto implícito por URL" sin botón.
 *
 * Numeración 03. para correr DESPUÉS de los middlewares saas
 * (01.detect-subdomain, 02.validate-tenant).
 */
import type { AppDefinition } from '../app.config'

export default defineNuxtRouteMiddleware(async (to) => {
  const appConfig = useAppConfig()
  const apps = (appConfig.innertia?.apps ?? {}) as Record<string, AppDefinition>
  const list = Object.values(apps)

  // Si el producto no declaró apps, el feature está inactivo
  if (list.length === 0) return

  // ¿La ruta cae bajo algún app?
  const targetApp = list.find(app =>
    to.path === app.path || to.path.startsWith(app.path + '/')
  )

  if (!targetApp) return  // ruta pública / fuera de apps

  // La ruta de login del propio app no requiere permisos del contexto
  if (to.path === targetApp.loginPath) return

  const authStore = useAuthStore()

  // Si no está autenticado, deja que el middleware `auth` de la página haga el redirect
  if (!authStore.isAuthenticated()) return

  // ── Hidratación defensiva ─────────────────────────────────────────────────
  // `availableContexts` se persiste en localStorage, que NO se lee en SSR.
  // El plugin auth-init hace fetchMe en SSR pero puede fallar silenciosamente
  // (ej. tenant no resuelto). Si llegamos con token válido pero array vacío,
  // intentamos cargar los contextos antes de decidir el redirect.
  if ((authStore.availableContexts ?? []).length === 0) {
    try {
      const { fetchMe } = useAuth()
      await fetchMe()
    } catch {
      // no podemos resolver — pasamos: mejor renderizar la página que redirigir mal
      return
    }
  }

  const userContexts = (authStore.availableContexts ?? []) as string[]

  // Si tras hidratar seguimos sin contextos, NO redirigimos.
  if (userContexts.length === 0) return

  // ¿Tiene acceso al contexto del app?
  if (!userContexts.includes(targetApp.context)) {
    const fallback = list.find(app => userContexts.includes(app.context))
    if (fallback) {
      return navigateTo(fallback.home, { replace: true })
    }
    return navigateTo(list[0]?.loginPath ?? '/', { replace: true })
  }

  // Sincronizar currentContext silenciosamente si cambia
  if (authStore.currentContext !== targetApp.context) {
    authStore.setCurrentContext(targetApp.context)
    try {
      const { fetchMe } = useAuth()
      await fetchMe()
    } catch {
      // best-effort
    }
  }
})
