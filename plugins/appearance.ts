// Reads the hs_theme cookie (set by SwitchColorTheme + applyAppearance) and applies
// the dark class to <html> during SSR so there's no flash on first paint.
export default defineNuxtPlugin(() => {
  const cookie = useCookie('hs_theme')
  if (cookie.value === 'dark') {
    useHead({ htmlAttrs: { class: 'dark' } })
  }
})
