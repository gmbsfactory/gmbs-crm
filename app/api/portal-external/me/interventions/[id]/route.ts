import { NextResponse } from 'next/server'
import { authenticatePortalRequest, portalError } from '@/lib/portal-external/auth'
import { portalInternalError } from '@/lib/portal-external/http'
import { getPortalIntervention, listPortalInterventionDocuments } from '@/lib/portal-external/interventions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/portal-external/me/interventions/{id}
 * Détail d'une mission (+ agence, photos, devis, dernier rapport).
 * 404 uniforme si l'artisan n'y est pas affecté.
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  try {
    const result = await getPortalIntervention(auth.supabase, auth.artisan.id, id)
    if (!result) return portalError(404, 'Intervention not found')

    const documents = await listPortalInterventionDocuments(auth.supabase, result.intervention.id)
    return NextResponse.json({ intervention: result.intervention, documents, report: result.report })
  } catch (error) {
    return portalInternalError('me/interventions/[id]', error)
  }
}
