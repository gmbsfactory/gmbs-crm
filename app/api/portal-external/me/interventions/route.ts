import { NextResponse } from 'next/server'
import { authenticatePortalRequest } from '@/lib/portal-external/auth'
import { portalInternalError } from '@/lib/portal-external/http'
import { listPortalInterventions } from '@/lib/portal-external/interventions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portal-external/me/interventions
 * Missions de l'artisan authentifié (statuts ACCEPTE, INTER_EN_COURS, SAV,
 * INTER_TERMINEE), triées par date prévue.
 */
export async function GET(request: Request) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response

  try {
    const interventions = await listPortalInterventions(auth.supabase, auth.artisan.id)
    return NextResponse.json({ interventions, count: interventions.length })
  } catch (error) {
    return portalInternalError('me/interventions', error)
  }
}
