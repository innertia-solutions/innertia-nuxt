// Contrato de useApi ante un 401. Fuera del auto-import de Nuxt (subcarpeta sin
// index): son helpers internos, testeables sin el runtime de Nuxt.

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Vuelve a ingresar; los cambios no se guardaron.'

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

/** ¿Un 401 debe lanzar (true) o devolver null (false)? Ver contrato en makeRequest. */
export function shouldThrowOnUnauthorized(method, options = {}, isClient = import.meta.client) {
  if (typeof options?.throwOnUnauthorized === 'boolean') return options.throwOnUnauthorized
  return !!isClient && MUTATING_METHODS.includes(String(method).toUpperCase())
}

/** Error de sesión expirada con la forma de los errores HTTP de useApi (status + data.message). */
export function unauthorizedError() {
  const err = new Error('Unauthenticated')
  err.status = 401
  err.data = { message: SESSION_EXPIRED_MESSAGE }
  return err
}

