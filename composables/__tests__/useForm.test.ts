import { describe, it, expect, beforeAll } from 'vitest'
import * as vue from 'vue'

// useForm usa auto-imports de Nuxt (reactive, watch, toRefs): se exponen como globales.
let useForm: any
beforeAll(async () => {
  Object.assign(globalThis, { reactive: vue.reactive, watch: vue.watch, toRefs: vue.toRefs })
  ;({ useForm } = await import('../useForm.js'))
})

describe('useForm: limpieza de errores al cambiar el valor', () => {
  it('borra el error de "obligatorio" al elegir un valor', () => {
    const { values, errors, validate } = useForm({ subject_id: { value: null, rules: ['required'] } })
    expect(validate()).toBe(false)
    expect(errors.subject_id).toEqual(['Este campo es obligatorio'])
    values.subject_id = 'abc'
    expect(errors.subject_id).toEqual([])
  })

  it('borra el error del backend (addError) al editar el campo', () => {
    const { values, errors, addError } = useForm({ email: { value: 'a@b.cl' } })
    addError('email', 'validation.unique')
    expect(errors.email).toEqual(['Ya está registrado'])
    values.email = 'c@d.cl'
    expect(errors.email).toEqual([])
  })

  it('no pierde un error agregado justo después de asignar el valor', () => {
    const { values, errors, addError } = useForm({ password: { value: 'x' } })
    values.password = ''
    addError('password', 'La contraseña no es válida')
    expect(errors.password).toEqual(['La contraseña no es válida'])
  })

  it('no toca los errores de otros campos', () => {
    const { values, errors, validate } = useForm({
      a: { value: '', rules: ['required'] },
      b: { value: '', rules: ['required'] },
    })
    validate()
    values.a = 'x'
    expect(errors.a).toEqual([])
    expect(errors.b).toEqual(['Este campo es obligatorio'])
  })
})
