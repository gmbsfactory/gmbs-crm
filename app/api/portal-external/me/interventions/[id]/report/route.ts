import { NextResponse } from 'next/server'
import { authenticatePortalRequest, portalError } from '@/lib/portal-external/auth'
import { portalInternalError, readJsonBody } from '@/lib/portal-external/http'
import { getPortalIntervention } from '@/lib/portal-external/interventions'
import { submitPortalReport, validateReportBody } from '@/lib/portal-external/report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/portal-external/me/interventions/{id}/report
 * Dernier rapport de l'artisan pour cette mission → `{ report | null }`.
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  try {
    const result = await getPortalIntervention(auth.supabase, auth.artisan.id, id)
    if (!result) return portalError(404, 'Intervention not found')
    return NextResponse.json({ report: result.report })
  } catch (error) {
    return portalInternalError('me/interventions/[id]/report GET', error)
  }
}

/**
 * POST /api/portal-external/me/interventions/{id}/report
 * Envoi (idempotent sur `portal_report_id`) d'un rapport d'intervention.
 * 201 création, 200 rejeu, 404 non affecté, 409 statut incompatible.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const validation = validateReportBody(parsed.body)
  if (!validation.ok) return portalError(400, validation.error)

  try {
    const result = await submitPortalReport({
      supabase: auth.supabase,
      artisan: auth.artisan,
      interventionId: id,
      input: validation.value,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return portalInternalError('me/interventions/[id]/report POST', error)
  }
}
