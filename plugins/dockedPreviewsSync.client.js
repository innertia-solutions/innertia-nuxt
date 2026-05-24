/**
 * Sincroniza el store de previews minimizados entre pestañas del navegador.
 * Escucha los eventos `storage` que dispara localStorage cuando otra pestaña escribe.
 */
export default defineNuxtPlugin(() => {
  const store = useDockedPreviewsStore()

  window.addEventListener('storage', (event) => {
    if (event.key !== 'docked-previews' || !event.newValue) return
    try {
      const persisted = JSON.parse(event.newValue)
      store.hydrate(persisted.items ?? [])
    } catch {
      // JSON inválido — ignorar
    }
  })
})
