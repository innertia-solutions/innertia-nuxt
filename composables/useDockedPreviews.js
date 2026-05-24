/**
 * Composable para manejar los previews minimizados.
 *
 * - `docked` / `dock` / `undock` / `isActive` → Pinia store (persiste en localStorage, sync entre tabs)
 * - `activeDockId` / `activeDockRect` / expand / collapse → estado de UI efímero (no persistido)
 */
export function useDockedPreviews() {
  const store = useDockedPreviewsStore()

  // ─── UI state (no persiste) ───────────────────────────────────────────────────
  const activeDockId     = useState('docked-active-id',   () => null)
  const activeDockRect   = useState('docked-active-rect',  () => null)

  // ─── Acceso reactivo a los items persistidos ──────────────────────────────────
  const docked = computed(() => store.items)

  // ─── Dock / undock ────────────────────────────────────────────────────────────
  const dock = (payload) => store.add(payload)

  const undock = (id) => {
    store.remove(id)
    if (activeDockId.value === id) {
      activeDockId.value   = null
      activeDockRect.value = null
    }
  }

  const isActive = (id) => !!store.items.find(d => d.id === id)

  // ─── Panel flotante ───────────────────────────────────────────────────────────
  const expandDock = (id, rect = null) => {
    if (activeDockId.value === id) {
      activeDockId.value   = null
      activeDockRect.value = null
    } else {
      activeDockId.value   = id
      activeDockRect.value = rect ? { left: rect.left, width: rect.width } : null
    }
  }

  const collapseDock = () => {
    activeDockId.value   = null
    activeDockRect.value = null
  }

  return {
    docked,
    activeDockId,
    activeDockRect,
    dock,
    undock,
    isActive,
    expandDock,
    collapseDock,
  }
}
