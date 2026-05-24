<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { IconCalendar, IconX } from '@tabler/icons-vue'

const props = defineProps({
  modelValue: {
    type: [String, Date, Array],
    default: null
  },
  mode: {
    type: String,
    default: 'date', // 'date' | 'datetime' | 'time' | 'range' | 'range-time'
  },
  placeholder: {
    type: String,
    default: 'Seleccionar fecha'
  },
  minDate: {
    type: [String, Date],
    default: null
  },
  maxDate: {
    type: [String, Date],
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  clearable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const inputEl = ref(null)
const calendarInstance = ref(null)
const internalValue = ref('')

const isRange = computed(() => props.mode.includes('range'))
const hasTime = computed(() => props.mode.includes('time'))

const formatDateToDDMMYYYY = (isoString) => {
  if (!isoString || typeof isoString !== 'string') return isoString

  // isoString comes as YYYY-MM-DD or YYYY-MM-DD HH:mm
  const parts = isoString.split(' ')
  const datePart = parts[0].split('-')

  if (datePart.length === 3) {
    const formattedDate = `${datePart[2]}-${datePart[1]}-${datePart[0]}`
    if (parts[1]) {
      return `${formattedDate} ${parts[1]}`
    }
    return formattedDate
  }
  return isoString
}

const formatForDisplay = (val) => {
  if (!val) return ''

  // If it's a range, val is an array of 2 dates (YYYY-MM-DD or YYYY-MM-DD HH:mm)
  if (Array.isArray(val) && val.length === 2) {
    if (hasTime.value) {
      return `${formatDateToDDMMYYYY(val[0])} - ${formatDateToDDMMYYYY(val[1])}`
    }
    return `${formatDateToDDMMYYYY(val[0].split(' ')[0])} - ${formatDateToDDMMYYYY(val[1].split(' ')[0])}`
  }

  // Single date/datetime string
  if (typeof val === 'string') {
    return formatDateToDDMMYYYY(val)
  }

  return val.toString()
}

// Convert prop modelValue to internal text representation
watch(() => props.modelValue, (newVal) => {
  internalValue.value = formatForDisplay(newVal)
}, { immediate: true })


onMounted(async () => {
  // Dynamic import to avoid SSR issues
  try {
    const { Calendar: VanillaCalendar } = await import('vanilla-calendar-pro')
    await import('vanilla-calendar-pro/styles/index.css')

    // Prepare config options based on props.mode
    let type = 'default'
    let time = false
    let selectionDatesMode = 'single'

    if (props.mode === 'datetime') {
      time = true
    } else if (props.mode === 'time') {
      type = 'time'
    } else if (props.mode === 'range') {
      selectionDatesMode = 'multiple-ranged'
    } else if (props.mode === 'range-time') {
      selectionDatesMode = 'multiple-ranged'
      time = true
    }

    // Set initial theme based on HTML class
    const isDarkGlobal = useState('isDark')

    let options = {
      inputMode: true,
      locale: 'es',
      selectedTheme: isDarkGlobal.value ? 'dark' : 'light',
      selectionDatesMode: selectionDatesMode,
      selectionTimeMode: time ? 24 : false,
      type: type,
      onChangeToInput: (self, e) => {
        let dates = self.context.selectedDates || []
        let timeStr = self.context.selectedTime || ''

        if (dates[0]) {
          let res = dates[0]
          if (dates[1]) res = [dates[0], dates[1]]

          if (timeStr) {
            if (dates[1]) {
              res = [`${dates[0]} ${timeStr}`, `${dates[1]} ${timeStr}`]
            } else {
              res = `${dates[0]} ${timeStr}`
            }
          }
          emit('update:modelValue', res)
          emit('change', res)

          if (!isRange.value && !hasTime.value) {
            self.hide()
          }
        } else if (timeStr && type === 'time') {
          emit('update:modelValue', timeStr)
          emit('change', timeStr)
        } else {
          emit('update:modelValue', null)
          emit('change', null)
        }
      }
    }

    if (props.mode === 'time') {
      options.selectionDatesMode = false
      options.type = 'time'
    }

    if (inputEl.value) {
      calendarInstance.value = new VanillaCalendar(inputEl.value, options)
      calendarInstance.value.init()

      watch(() => isDarkGlobal.value, (newDark) => {
        if (calendarInstance.value) {
          calendarInstance.value.set({ selectedTheme: newDark ? 'dark' : 'light' })
        }
      })
    }
  } catch (e) {
    // Vanilla Calendar Pro load failed — silently continue
  }
})

onBeforeUnmount(() => {
  // Teardown
})

const clear = () => {
  emit('update:modelValue', null)
  emit('change', null)
}
</script>

<template>
  <div class="relative w-full">
    <div class="relative group">
      <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none z-20 ps-3.5">
        <IconCalendar class="size-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
      </div>

      <input
        ref="inputEl"
        type="text"
        :value="internalValue"
        :disabled="disabled"
        :placeholder="placeholder"
        class="w-full py-2 ps-10 pe-10 border border-gray-300 rounded-lg text-sm dark:bg-card dark:border-card-line dark:text-white disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus:border-blue-500 focus:ring-blue-500/20 outline-none transition-all block"
        readonly
      />

      <!-- Clear button -->
      <button
        v-if="clearable && internalValue && !disabled"
        @click.stop="clear"
        type="button"
        class="absolute inset-y-0 end-0 flex items-center z-20 pe-3 text-gray-400 hover:text-red-500 transition-colors focus:outline-none"
      >
        <IconX class="size-4" />
      </button>
    </div>
  </div>
</template>

<style>
/*
  Vanilla Calendar v3 compiles Tailwind classes directly into its themes.
  We override the selected date and hover backgrounds for Light and Dark modes.
*/

/* LIGHT MODE OVERRIDES */
[data-vc-theme=light] .vc-months__month[data-vc-months-month-selected],
[data-vc-theme=light] .vc-years__year[data-vc-years-year-selected],
[data-vc-theme=light] .vc-date[data-vc-date-selected=middle][data-vc-date-selected] .vc-date__btn,
[data-vc-theme=light] .vc-date[data-vc-date-selected] .vc-date__btn {
  background-color: #2563eb !important; /* blue-600 */
  color: #ffffff !important;
}

[data-vc-theme=light] .vc-months__month[data-vc-months-month-selected]:hover,
[data-vc-theme=light] .vc-years__year[data-vc-years-year-selected]:hover,
[data-vc-theme=light] .vc-date[data-vc-date-selected=middle][data-vc-date-selected] .vc-date__btn:hover,
[data-vc-theme=light] .vc-date[data-vc-date-selected] .vc-date__btn:hover {
  background-color: #1d4ed8 !important; /* blue-700 */
}

[data-vc-theme=light] .vc-date[data-vc-date-today] .vc-date__btn {
  color: #2563eb !important;
}

/* DARK MODE OVERRIDES */
[data-vc-theme=dark] .vc-months__month[data-vc-months-month-selected],
[data-vc-theme=dark] .vc-years__year[data-vc-years-year-selected],
[data-vc-theme=dark] .vc-date[data-vc-date-selected=middle][data-vc-date-selected] .vc-date__btn,
[data-vc-theme=dark] .vc-date[data-vc-date-selected] .vc-date__btn {
  background-color: #3b82f6 !important; /* blue-500 */
  color: #ffffff !important;
}

[data-vc-theme=dark] .vc-months__month[data-vc-months-month-selected]:hover,
[data-vc-theme=dark] .vc-years__year[data-vc-years-year-selected]:hover,
[data-vc-theme=dark] .vc-date[data-vc-date-selected=middle][data-vc-date-selected] .vc-date__btn:hover,
[data-vc-theme=dark] .vc-date[data-vc-date-selected] .vc-date__btn:hover {
  background-color: #2563eb !important; /* blue-600 */
}

[data-vc-theme=dark] .vc-date[data-vc-date-today] .vc-date__btn {
  color: #3b82f6 !important;
}
</style>
