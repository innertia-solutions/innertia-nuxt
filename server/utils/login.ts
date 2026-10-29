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
