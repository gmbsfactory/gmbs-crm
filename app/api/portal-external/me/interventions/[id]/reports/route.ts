import { NextResponse } from 'next/server'
import { authenticatePortalRequest } from '@/lib/portal-external/auth'
import { portalInternalError } from '@/lib/portal-external/http'
import { listPortalReports } from '@/lib/portal-external/report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/portal-external/me/interventions/{id}/reports
 *
 * Historique des versions du rapport de CET artisan (§4.2, §6.5) :
 * `{ reports: [{ id, version, status, submitted_at, started_at, reviewed_at,
 * review_comment, superseded_at, photos_count, is_current }], current_report_id }`.
 * Sur une intervention à deux artisans, chacun ne voit que ses propres versions.
 * 404 uniforme si l'artisan n'est pas affecté.
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  try {
    const result = await listPortalReports({
      supabase: auth.supabase,
      artisanId: auth.artisan.id,
      interventionId: id,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return portalInternalError('me/interventions/[id]/reports GET', error)
  }
}
