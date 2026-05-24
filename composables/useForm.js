const rules = {
  required: (value) => {
    if (value === null || value === undefined) return 'Este campo es obligatorio'
    if (typeof value === 'string' && value.trim() === '') return 'Este campo es obligatorio'
    if (Array.isArray(value) && value.length === 0) return 'Este campo es obligatorio'
    return true
  },
  email: (value) => /.+@.+\..+/.test(value) || 'El correo no es válido',
  min: (value, arg) => value.length >= arg || `Debe tener al menos ${arg} caracteres`,
  int: (value) => Number.isInteger(+value) || 'Debe ser un número entero',
  rut: (value) => validateRut(value) || 'El RUT no es válido',
  same: (value, arg, form) => value === form[arg] || 'Los campos no coinciden',
}

const dictionary = {
  unique: 'Ya está registrado',
  required: 'Este campo es obligatorio',
  invalid: 'Dato inválido',
}

function validateRut(rut) {
  if (!rut || typeof rut !== 'string') return false
  rut = rut.replace(/^0+|[^0-9kK]+/g, '').toUpperCase()
  if (rut.length < 8) return false
  const body = rut.slice(0, -1)
  const dv = rut.slice(-1)
  let sum = 0, multiplier = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier
    multiplier = multiplier < 7 ? multiplier + 1 : 2
  }
  const expected = 11 - (sum % 11)
  const expectedDV = expected === 11 ? '0' : expected === 10 ? 'K' : expected.toString()
  return dv === expectedDV
}

export function useForm(formDefinition, options = {}) {
  const zodSchema = options.zodSchema
  const form = reactive({})
  const errors = reactive({})

  for (const field in formDefinition) {
    form[field] = formDefinition[field]?.value !== undefined ? formDefinition[field].value : ''
    errors[field] = []
  }

  const reset = () => {
    for (const field in formDefinition) {
      form[field] = formDefinition[field]?.value !== undefined ? formDefinition[field].value : ''
      errors[field] = []
    }
  }

  const resetErrors = () => {
    for (const field in formDefinition) {
      errors[field] = []
    }
  }

  const validateField = (field) => {
    const def = formDefinition[field]
    const value = form[field]
    errors[field] = []
    if (!def?.rules) return true
    def.rules.forEach(rule => {
      const ruleName = typeof rule === 'string' ? rule : rule.name
      const arg = typeof rule === 'object' ? rule.arg : undefined
      const result = rules[ruleName](value, arg, form)
      if (result !== true) {
        const custom = def.messages?.[ruleName]
        errors[field].push(custom || result)
      }
    })
    return errors[field].length === 0
  }

  const validateForm = () => {
    if (zodSchema) {
      const result = zodSchema.safeParse(form)
      resetErrors()
      if (!result.success) {
        for (const issue of result.error.errors) {
          const field = issue.path[0]
          if (errors[field] !== undefined) errors[field].push(issue.message)
        }
        return false
      }
      return true
    }
    for (const field in formDefinition) validateField(field)
    return Object.values(errors).every(e => e.length === 0)
  }

  const addError = (field, message) => {
    if (message.startsWith('validation.')) {
      const key = message.split('.')[1]
      message = dictionary[key] || key
    }
    if (errors[field] !== undefined) errors[field].push(message)
  }

  const loadFromObject = (obj) => {
    for (const field in formDefinition) {
      if (obj[field] !== undefined) form[field] = obj[field]
    }
  }

  return {
    ...toRefs(form),
    values: form,
    errors,
    validate: (field) => field ? validateField(field) : validateForm(),
    reset,
    resetErrors,
    addError,
    loadFromObject,
    config: formDefinition,
  }
}
