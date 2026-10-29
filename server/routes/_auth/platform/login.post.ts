import { defineEventHandler, readBody, createError } from 'h3'
import { writeSession } from '../../../utils/session'
import { normalizeLoginResponse } from '../../../utils/login'

// Login de plataforma (identidad separada, sin contexto de tenant). Llama a
// Laravel /platform/auth/login server-to-server; en éxito sella el JWT en la
// sesión httpOnly (igual que /_auth/login) y devuelve el body SIN token. Es
// imprescindible que pase por acá y no por el BFF catch-all /api/**, que solo
// proxea y NO sella la cookie → la sesión nunca quedaría establecida.
export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)
  const config = useRuntimeConfig(event)
  let data: any
  try {
    data = await $fetch(`${config.apiInternalUrl}/platform/auth/login`, {
      method: 'POST',
      body: { email, password },
      headers: { Accept: 'application/json' },
    })
  } catch (err: any) {
    const status = err?.response?.status ?? err?.statusCode ?? 500
    throw createError({ statusCode: status, data: err?.data ?? null, statusMessage: 'login_failed' })
  }
  const { token, body } = normalizeLoginResponse(data)
  await writeSession(event, { token })
  return body
})
