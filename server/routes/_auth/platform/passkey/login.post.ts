import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3'
import { writeSession } from '../../../../utils/session'
import { forwardClientHeaders } from '../../../../utils/bff'
import { normalizePasskeyLoginResponse, passkeyLoginErrorMessage } from '../../../../utils/passkeyLogin'

// Ingreso con passkey a /platform (identidad separada, sin contexto de tenant).
// Igual que /_auth/platform/login: sella el JWT y devuelve el body sin token.
export default defineEventHandler(async (event) => {
  const { key, response } = await readBody(event)
  const config = useRuntimeConfig(event)
  let data: any
  try {
    data = await $fetch(`${config.apiInternalUrl}/platform/auth/passkey/login`, {
      method: 'POST',
      body: { key, response },
      headers: { Accept: 'application/json', ...forwardClientHeaders(n => getRequestHeader(event, n)) },
    })
  } catch (err: any) {
    const status = err?.response?.status ?? err?.statusCode ?? 500
    throw createError({ statusCode: status, data: err?.data ?? null, statusMessage: 'passkey_login_failed', message: passkeyLoginErrorMessage(status, err?.data) })
  }
  const { token, body } = normalizePasskeyLoginResponse(data)
  if (token) await writeSession(event, { token })
  return body
})
