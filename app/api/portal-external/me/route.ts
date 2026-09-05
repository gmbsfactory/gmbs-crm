import { NextResponse } from 'next/server'
import { authenticatePortalRequest } from '@/lib/portal-external/auth'
import { portalInternalError } from '@/lib/portal-external/http'
import { listPortalInterventions, type PortalMissionGroup } from '@/lib/portal-external/interventions'
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

    // Compteurs recalés sur les TROIS GROUPES de l'application (§6.3), et non plus
    // sur une liste de statuts : « en cours » comptait `PORTAL_ONGOING_STATUSES`,
    // ce qui laissait `STAND_BY` hors compte et n'avait aucune case pour les
    // missions « à accepter ». Le groupe est calculé côté CRM (principe P1).
    const parGroupe = (groupe: PortalMissionGroup) => interventions.filter((i) => i.groupe === groupe).length
    const counters = {
      missions_total: interventions.length,
      missions_a_accepter: parGroupe('a_accepter'),
      missions_en_cours: parGroupe('en_cours'),
      missions_terminees: parGroupe('terminee'),
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
