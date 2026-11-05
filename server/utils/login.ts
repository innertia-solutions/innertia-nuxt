export interface LaravelLoginResponse {
  token?: string
  access_token?: string
  user?: unknown
  contexts?: string[]
  requires_password_change?: boolean
  [k: string]: unknown
}

/** Pasos previos al token que Laravel puede exigir (todos traen user_id, sin token). */
export const LOGIN_CHALLENGES = ['requires_otp', 'requires_2fa', 'requires_email_verification'] as const

/** Separa el token (va a la sesión) del body que vuelve al cliente (sin token).
 *  Sin token (cambio forzado / OTP / 2FA / verificación) se reenvía user_id y el
 *  flag: el cliente lo necesita para el paso siguiente (antes se perdía). */
export function normalizeLoginResponse(data: LaravelLoginResponse) {
  const token = data.token ?? data.access_token
  const body: Record<string, unknown> = {
    user: data.user ?? null,
    contexts: data.contexts ?? [],
    requires_password_change: data.requires_password_change ?? false,
  }
  for (const k of LOGIN_CHALLENGES) if (data[k]) body[k] = true
  if (!token && data.user_id != null) body.user_id = data.user_id
  return { token, body }
}

/** true si la respuesta es un paso previo (no hay sesión que sellar). */
export function isLoginChallenge(body: Record<string, unknown>): boolean {
  return Boolean(body.requires_password_change) || LOGIN_CHALLENGES.some(k => body[k])
}

/**
 * Mensaje legible para un login fallido. Va en `message` del error H3 (lo que el
 * cliente lee como e.data.message), en vez del statusMessage técnico 'login_failed'.
 * 422 = credenciales inválidas (Laravel responde un genérico en inglés).
 */
export function loginErrorMessage(status: number, data: any): string {
  if (status === 422) return 'Correo o contraseña incorrectos.'
  if (status === 429) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'
  return (typeof data?.message === 'string' && data.message) || 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}
