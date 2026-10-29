import { defineEventHandler, readBody, createError } from 'h3'
import { writeSession } from '../../utils/session'
import { normalizeLoginResponse } from '../../utils/login'

// Llama a Laravel /auth/login server-to-server; en éxito sella el JWT en la
// sesión y devuelve el body SIN token. Propaga el status de Laravel (403 = el
// usuario no posee ese contexto → el probing del cliente prueba el siguiente).
export default defineEventHandler(async (event) => {
  const { context, email, password, remember } = await readBody(event)
  const config = useRuntimeConfig(event)
  let data: any
  try {
    data = await $fetch(`${config.apiInternalUrl}/auth/login`, {
      method: 'POST',
      body: { context, email, password, remember },
      headers: { Accept: 'application/json' },
    })
  } catch (err: any) {
    const status = err?.response?.status ?? err?.statusCode ?? 500
    throw createError({ statusCode: status, data: err?.data ?? null, statusMessage: 'login_failed' })
  }
  const { token, body } = normalizeLoginResponse(data)
  await writeSession(event, { token, currentContext: context })
  return body
})
