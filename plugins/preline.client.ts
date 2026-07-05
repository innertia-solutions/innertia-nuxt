declare global {
  interface Window {
    HSStaticMethods?: { autoInit?: () => void }
    HSSelect?: new (el: HTMLElement) => { destroy?: () => void }
    HSThemeAppearance?: { init?: () => void }
    FloatingUIDOM?: unknown
  }
}

export default defineNuxtPlugin(async () => {
  if (!process.client) return

  try {
    // Preline 3 lee `window.FloatingUIDOM` (global, no import) para posicionar
    // dropdowns con `dropdownScope:'window'` (los teletransporta al body y flota
    // con floating-ui, escapando cualquier overflow — ej. selects dentro de modales).
    if (!window.FloatingUIDOM) {
      window.FloatingUIDOM = await import('@floating-ui/dom')
    }

    await import('preline')

    const initPreline = () => {
      try { window.HSStaticMethods?.autoInit?.() } catch (_) {}
      try { window.HSThemeAppearance?.init?.() } catch (_) {}
    }

    const performMultipleInits = () => {
      initPreline()
      setTimeout(initPreline, 50)
      setTimeout(initPreline, 200)
      setTimeout(initPreline, 500)
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', performMultipleInits)
    } else {
      nextTick(performMultipleInits)
    }

    const nuxtApp = useNuxtApp()
    nuxtApp.hooks.hookOnce('app:mounted', () => performMultipleInits())
    nuxtApp.hooks.hook('page:finish', () => requestAnimationFrame(performMultipleInits))

    const observer = new MutationObserver((mutations) => {
      const hasPreline = mutations.some(({ addedNodes }) =>
        Array.from(addedNodes).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false
          const el = node as Element
          return (
            el.querySelector?.('[data-hs-overlay],[data-hs-dropdown],[data-hs-select]') ||
            el.hasAttribute?.('data-hs-overlay') ||
            el.hasAttribute?.('data-hs-dropdown') ||
            el.hasAttribute?.('data-hs-select') ||
            (typeof el.className === 'string' && el.className.includes('hs-'))
          )
        })
      )
      if (hasPreline) {
        setTimeout(initPreline, 10)
        setTimeout(initPreline, 100)
      }
    })

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () =>
        observer.observe(document.body, { childList: true, subtree: true })
      )
    } else {
      observer.observe(document.body, { childList: true, subtree: true })
    }

  } catch (e) {
    console.warn('[nuxt-core] Error al cargar Preline:', e)
  }
})
