/**
 * useTheme — lee y cambia el tema dark/light.
 *
 * Usa la cookie `hs_theme` para compatibilidad SSR con el plugin appearance.ts
 * y con el componente <AppSwitchColorTheme />.
 */
export function useTheme() {
  const cookie = useCookie<'dark' | 'light'>('hs_theme', {
    default: () => 'light',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  const isDark = computed(() => cookie.value === 'dark')

  const toggle = () => {
    const next = cookie.value === 'dark' ? 'light' : 'dark'
    cookie.value = next
    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', next === 'dark')
      localStorage.setItem('hs_theme', next)
    }
  }

  return { isDark, toggle }
}
