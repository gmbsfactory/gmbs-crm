import { NextResponse } from 'next/server'
import { portalAuthErrorResponse, resolvePortalToken, validatePortalApiRequest } from '@/lib/portal-external/auth'
import { portalInternalError, readJsonBody } from '@/lib/portal-external/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/portal-external/tokens/validate
 * Corps `{ token }` → `200 { valid: true, artisan }` ou `401 { valid: false, error }`.
 * Appelée par la page `/t/{token}` du portail avant de poser le cookie.
 */
export async function POST(request: Request) {
  const apiCheck = validatePortalApiRequest(request)
  if (!apiCheck.ok) return portalAuthErrorResponse(apiCheck)

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  try {
    const resolution = await resolvePortalToken(typeof parsed.body.token === 'string' ? parsed.body.token : null)
    if (!resolution.ok) {
      return NextResponse.json({ valid: false, error: resolution.error }, { status: resolution.status })
    }
    return NextResponse.json({ valid: true, artisan: resolution.artisan })
  } catch (error) {
    return portalInternalError('tokens/validate', error)
  }
}
