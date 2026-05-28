import { useMediaQuery } from '@vueuse/core'
import type { ContextDefinition } from '../app.config'

const PICKER_CHOICE_COOKIE = 'innertia_mobile_context_choice'
const PICKER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  // 30 días

/**
 * Detección reactiva de viewport mobile + lógica de landing.
 *
 * Reglas para `landing` (qué mostrar cuando el usuario entra a `/` en mobile):
 *   - 0 contextos mobile-friendly  → blocker "abre en escritorio"
 *   - 1 contexto mobile-friendly   → redirect directo al login de ese contexto
 *   - 2+ contextos mobile-friendly → picker (con cookie para recordar última elección)
 *
 * El breakpoint se lee desde `appConfig.innertia.mobile.breakpoint` (default 1024).
 */
export function useMobileGuard() {
  const { all, current, accessible } = useContext()
  const authStore = useAuthStore()
  const appConfig = useAppConfig()

  const breakpoint: number = appConfig.innertia?.mobile?.breakpoint ?? 1024
  const isMobile = useMediaQuery(`(max-width: ${breakpoint - 1}px)`)

  /** Contextos con mode 'allow' en mobile. */
  const mobileApps = computed<ContextDefinition[]>(() =>
    all.value.filter(a => a.mobile?.mode === 'allow')
  )

  /** Contextos mobile-friendly + accesibles para el usuario autenticado. */
  const mobileAccessibleApps = computed<ContextDefinition[]>(() =>
    accessible.value.filter(a => a.mobile?.mode === 'allow')
  )

  /** ¿El contexto actual está bloqueado en mobile? */
  const isCurrentAppBlocked = computed<boolean>(() => {
    if (!isMobile.value) return false
    if (!current.value) return false
    return current.value.mobile?.mode === 'block'
  })

  /**
   * Para el blocker: si el usuario está autenticado y tiene OTRO contexto mobile-friendly,
   * lo ofrecemos como fallback ("continuar en X").
   */
  const mobileFallbackApp = computed<ContextDefinition | null>(() => {
    if (!authStore.isAuthenticated()) return null
    return mobileAccessibleApps.value[0] ?? null
  })

  // ── Cookie helpers para recordar última elección del picker ─────────────────
  function rememberPickerChoice(contextKey: string) {
    if (!(appConfig.innertia?.mobile?.rememberChoice ?? true)) return
    const cookie = useCookie<string | null>(PICKER_CHOICE_COOKIE, {
      maxAge: PICKER_COOKIE_MAX_AGE,
      sameSite: 'lax',
    })
    cookie.value = contextKey
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
