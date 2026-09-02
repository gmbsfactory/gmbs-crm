import { NextResponse } from 'next/server'
import { authenticatePortalRequest } from '@/lib/portal-external/auth'
import { portalInternalError } from '@/lib/portal-external/http'
import { PORTAL_ONGOING_STATUSES, listPortalInterventions } from '@/lib/portal-external/interventions'
import { REQUIRED_DOCUMENT_KINDS, countRequiredDocuments } from '@/lib/artisans/dossierStatus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portal-external/me
 * Profil de l'artisan + compteurs de missions + avancement du dossier.
 */
export async function GET(request: Request) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { artisan, supabase } = auth

  try {
    const [interventions, attachmentsRes] = await Promise.all([
      listPortalInterventions(supabase, artisan.id),
      supabase.from('artisan_attachments').select('id, artisan_id, kind, url').eq('artisan_id', artisan.id),
    ])

    const ongoing = PORTAL_ONGOING_STATUSES as readonly string[]
    const counters = {
      missions_total: interventions.length,
      missions_terminees: interventions.filter((i) => i.statut_code === 'INTER_TERMINEE').length,
      missions_en_cours: interventions.filter((i) => ongoing.includes(i.statut_code ?? '')).length,
    }

    return NextResponse.json({
      artisan,
      counters,
      documents: {
        required: REQUIRED_DOCUMENT_KINDS.length,
        present: countRequiredDocuments(attachmentsRes.data ?? []),
      },
    })
  } catch (error) {
    return portalInternalError('me', error)
  }
}
