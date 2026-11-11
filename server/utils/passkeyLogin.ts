import { normalizeLoginResponse, type LaravelLoginResponse } from './login'

/** Igual que normalizeLoginResponse, conservando el contexto que eligió Laravel
 *  (el ingreso con passkey recibe una lista de contextos y entra al primero válido). */
export function normalizePasskeyLoginResponse(data: LaravelLoginResponse & { context?: string }) {
  const { token, body } = normalizeLoginResponse(data)
  if (typeof data.context === 'string' && data.context) body.context = data.context
  return { token, body }
}

export function passkeyLoginErrorMessage(status: number, data: any): string {
  if (status === 422) return 'No pudimos verificar la passkey.'
  if (status === 429) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'
  return (typeof data?.message === 'string' && data.message) || 'No se pudo iniciar sesión con la passkey. Inténtalo de nuevo.'
}
