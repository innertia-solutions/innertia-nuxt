export default defineNuxtPlugin(() => {
  if (!process.client) return

  const isDark = useState<boolean>('isDark', () => false)

  const updateTheme = () => {
    if (typeof document !== 'undefined') {
      isDark.value = document.documentElement.classList.contains('dark')
    }
  }

  let observer: MutationObserver | null = null

  const initializeTheme = () => {
    updateTheme()
    if (observer) observer.disconnect()
    observer = new MutationObserver(() => updateTheme())
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTheme)
  } else {
    nextTick(initializeTheme)
  }
})
