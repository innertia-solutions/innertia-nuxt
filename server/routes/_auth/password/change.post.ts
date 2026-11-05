import { defineEventHandler, readBody } from 'h3'
import { forwardAuthStep } from '../../../utils/authStep'

// Cambio de clave forzado (pre-auth): cambia la clave (con el código OTP si el
// backend lo exige) y sella la sesión con el token que devuelve Laravel.
export default defineEventHandler(async (event) => {
  const { context, user_id, code, password, password_confirmation } = await readBody(event)
  return forwardAuthStep(event, 'auth/password/change', { user_id, code, password, password_confirmation, context }, context)
})
