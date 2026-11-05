import { defineEventHandler, readBody } from 'h3'
import { forwardAuthStep } from '../../../utils/authStep'

// Verifica el código OTP que el login envió por correo y sella la sesión.
export default defineEventHandler(async (event) => {
  const { context, user_id, code, action = 'login' } = await readBody(event)
  return forwardAuthStep(event, 'auth/otp/verify', { user_id, code, action, context }, context)
})
