import { defineEventHandler, getRouterParam, getQuery, sendRedirect, createError } from 'h3'
import { writeSession } from '../../../utils/session'
import { normalizeLoginResponse } from '../../../utils/login'

// Recibe el callback de OAuth, intercambia contra Laravel, sella la sesión y
// redirige a la app. El token nunca llega al browser.
export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  const query = getQuery(event)
  const config = useRuntimeConfig(event)
  const context = (query.context as string) || 'backoffice'
  let data: any
  try {
    data = await $fetch(`${config.apiInternalUrl}/api/auth/${provider}/callback`, {
      method: 'GET', query, headers: { Accept: 'application/json' },
    })
  } catch (err: any) {
    const msg = err?.data?.message ?? 'oauth_failed'
    return sendRedirect(event, `${config.public.loginPath}?social_error=${encodeURIComponent(msg)}`)
  }
  const { token } = normalizeLoginResponse(data)
  if (!token) throw createError({ statusCode: 502, statusMessage: 'oauth_no_token' })
  await writeSession(event, { token, currentContext: context })
  return sendRedirect(event, config.public.homePath)
})
