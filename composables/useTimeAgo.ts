import { ref, isRef, onMounted, onBeforeUnmount } from 'vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/es'

dayjs.extend(utc)
dayjs.extend(relativeTime)
dayjs.locale('es')

/**
 * Returns a reactive `timeAgo()` that updates every 60s.
 * @param {string | Ref<string>} utcDatetime - UTC datetime string or a ref to one
 */
export const useTimeAgo = (utcDatetime) => {
    const now = ref(new Date())
    let interval

    onMounted(() => {
        interval = setInterval(() => {
            now.value = new Date()
        }, 60000)
    })

    onBeforeUnmount(() => {
        clearInterval(interval)
    })

    const timeAgo = () => {
        const value = isRef(utcDatetime) ? utcDatetime.value : utcDatetime
        if (!value) return ''
        // Force UTC parse then compare to local now
        return dayjs.utc(value).local().from(now.value)
    }

    return { timeAgo }
}
