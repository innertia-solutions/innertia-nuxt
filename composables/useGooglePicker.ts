/**
 * useGooglePicker — carga la Google API JS y abre el Google Picker. Client-only.
 *
 * Uso:
 *   const { openPicker } = useGooglePicker()
 *   const picked = await openPicker({ apiKey, token, appId, mode: 'file', mimeTypes })
 *   // picked === { id, name, mimeType, url } o null si se cancela
 */
export function useGooglePicker() {
  let pickerApiLoaded = false

  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve()
      const s = document.createElement('script')
      s.src = src
      s.onload = () => resolve()
      s.onerror = reject
      document.head.appendChild(s)
    })
  }

  async function ensureLoaded() {
    if (pickerApiLoaded) return
    await loadScript('https://apis.google.com/js/api.js')
    await new Promise<void>((res) => (window as any).gapi.load('picker', () => res()))
    pickerApiLoaded = true
  }

  /**
   * Abre el Google Picker. opts: { apiKey, token, appId, mode: 'file'|'folder', mimeTypes?: string }
   * Resuelve con { id, name, mimeType, url } del item elegido, o null si se cancela.
   */
  async function openPicker(opts: {
    apiKey: string
    token: string
    appId: string
    mode: 'file' | 'folder'
    mimeTypes?: string
  }) {
    if (typeof window === 'undefined') return null
    await ensureLoaded()
    return new Promise((resolve) => {
      const google = (window as any).google
      const view = opts.mode === 'folder'
        ? new google.picker.DocsView(google.picker.ViewId.FOLDERS).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder')
        : new google.picker.DocsView(google.picker.ViewId.DOCS)
      if (opts.mimeTypes && opts.mode !== 'folder') view.setMimeTypes(opts.mimeTypes)

      const picker = new google.picker.PickerBuilder()
        .setAppId(opts.appId)
        .setOAuthToken(opts.token)
        .setDeveloperKey(opts.apiKey)
        .addView(view)
        .setCallback((data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0]
            resolve({ id: doc.id, name: doc.name, mimeType: doc.mimeType, url: doc.url })
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve(null)
          }
        })
        .build()
      picker.setVisible(true)
    })
  }

  return { openPicker }
}
