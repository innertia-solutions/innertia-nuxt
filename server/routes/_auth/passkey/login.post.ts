import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3'
import { writeSession } from '../../../utils/session'
import { forwardClientHeaders } from '../../../utils/bff'
import { normalizePasskeyLoginResponse, passkeyLoginErrorMessage } from '../../../utils/passkeyLogin'

// Ingreso con passkey (tenant). Laravel valida la assertion y entra al primer
// contexto de `contexts` al que el usuario tenga acceso. En éxito sella el JWT
// en la sesión httpOnly con ese contexto y devuelve el body SIN token. Pasos
// previos (cambio forzado / verificación de correo) no traen token: no se sella.
export default defineEventHandler(async (event) => {
  const { key, response, contexts } = await readBody(event)
  const config = useRuntimeConfig(event)
  let data: any
  try {
    data = await $fetch(`${config.apiInternalUrl}/auth/passkey/login`, {
      method: 'POST',
      body: { key, response, contexts },
      headers: { Accept: 'application/json', ...forwardClientHeaders(n => getRequestHeader(event, n)) },
    })
  } catch (err: any) {
    const status = err?.response?.status ?? err?.statusCode ?? 500
    throw createError({ statusCode: status, data: err?.data ?? null, statusMessage: 'passkey_login_failed', message: passkeyLoginErrorMessage(status, err?.data) })
  }
  const { token, body } = normalizePasskeyLoginResponse(data)
  if (token) await writeSession(event, { token, currentContext: body.context as string | undefined })
  return body
})
