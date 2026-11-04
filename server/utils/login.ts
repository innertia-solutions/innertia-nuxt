export interface LaravelLoginResponse {
  token?: string
  access_token?: string
  user?: unknown
  contexts?: string[]
  requires_password_change?: boolean
  [k: string]: unknown
}

/** Separa el token (va a la sesión) del body que vuelve al cliente (sin token). */
export function normalizeLoginResponse(data: LaravelLoginResponse) {
  const token = data.token ?? data.access_token
  return {
    token,
    body: {
      user: data.user ?? null,
      contexts: data.contexts ?? [],
      requires_password_change: data.requires_password_change ?? false,
    },
  }
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
