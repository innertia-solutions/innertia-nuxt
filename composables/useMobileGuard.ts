import { useMediaQuery } from '@vueuse/core'
import type { AppDefinition } from '../app.config'

const PICKER_CHOICE_COOKIE = 'innertia_mobile_app_choice'
const PICKER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  // 30 días

/**
 * Detección reactiva de viewport mobile + lógica de landing.
 *
 * Reglas para `landing` (qué mostrar cuando el usuario entra a `/` en mobile):
 *   - 0 apps mobile-friendly  → blocker "abre en escritorio"
 *   - 1 app mobile-friendly   → redirect directo al login de ese app
 *   - 2+ apps mobile-friendly → picker (con cookie para recordar última elección)
 *
 * El breakpoint se lee desde `appConfig.innertia.mobile.breakpoint` (default 1024).
 */
export function useMobileGuard() {
  const { all, current, accessible } = useApp()
  const authStore = useAuthStore()
  const appConfig = useAppConfig()

  const breakpoint: number = appConfig.innertia?.mobile?.breakpoint ?? 1024
  const isMobile = useMediaQuery(`(max-width: ${breakpoint - 1}px)`)

  /** Apps con mode 'allow' en mobile. */
  const mobileApps = computed<AppDefinition[]>(() =>
    all.value.filter(a => a.mobile?.mode === 'allow')
  )

  /** Apps mobile-friendly + accesibles para el usuario autenticado. */
  const mobileAccessibleApps = computed<AppDefinition[]>(() =>
    accessible.value.filter(a => a.mobile?.mode === 'allow')
  )

  /** ¿El app actual está bloqueado en mobile? */
  const isCurrentAppBlocked = computed<boolean>(() => {
    if (!isMobile.value) return false
    if (!current.value) return false
    return current.value.mobile?.mode === 'block'
  })

  /**
   * Para el blocker: si el usuario está autenticado y tiene OTRO app mobile-friendly,
   * lo ofrecemos como fallback ("continuar en X").
   */
  const mobileFallbackApp = computed<AppDefinition | null>(() => {
    if (!authStore.isAuthenticated()) return null
    return mobileAccessibleApps.value[0] ?? null
  })

  // ── Cookie helpers para recordar última elección del picker ─────────────────
  function rememberPickerChoice(appKey: string) {
    if (!(appConfig.innertia?.mobile?.rememberChoice ?? true)) return
    const cookie = useCookie<string | null>(PICKER_CHOICE_COOKIE, {
      maxAge: PICKER_COOKIE_MAX_AGE,
      sameSite: 'lax',
    })
    cookie.value = appKey
  }

  function getRememberedPickerChoice(): string | null {
    const cookie = useCookie<string | null>(PICKER_CHOICE_COOKIE)
    return cookie.value ?? null
  }

  function clearRememberedPickerChoice() {
    const cookie = useCookie<string | null>(PICKER_CHOICE_COOKIE)
    cookie.value = null
  }

  return {
    isMobile,
    mobileApps,
    mobileAccessibleApps,
    isCurrentAppBlocked,
    mobileFallbackApp,
    rememberPickerChoice,
    getRememberedPickerChoice,
    clearRememberedPickerChoice,
  }
}
