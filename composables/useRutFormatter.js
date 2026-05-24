import { ref, onMounted, onBeforeUnmount } from 'vue'

const formatRut = (rut) => {
    const clean = rut.replace(/[^\dKk]/g, '').toUpperCase()
    if (clean.length <= 1) return clean
    const body = clean.slice(0, -1)
    const dv = clean.slice(-1)
    const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `${formatted}-${dv}`
}

/**
 * Attaches RUT auto-formatting to an input element ref.
 * Cleans up the listener on unmount.
 *
 * @param {Ref<HTMLInputElement | null>} inputRef - template ref to the input
 * @returns {{ formattedRut: Ref<string> }}
 */
export const useRutFormatter = (inputRef) => {
    const formattedRut = ref('')

    const handler = (e) => {
        const value = formatRut(e.target.value)
        e.target.value = value
        formattedRut.value = value
    }

    onMounted(() => {
        const el = inputRef?.value ?? inputRef
        if (el) el.addEventListener('input', handler)
    })

    onBeforeUnmount(() => {
        const el = inputRef?.value ?? inputRef
        if (el) el.removeEventListener('input', handler)
    })

    return { formattedRut }
}
