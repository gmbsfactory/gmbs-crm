import { NextResponse } from 'next/server'
import { authenticatePortalRequest } from '@/lib/portal-external/auth'
import { portalInternalError } from '@/lib/portal-external/http'
import { listPortalInterventions, type PortalMissionGroup } from '@/lib/portal-external/interventions'
import {
  pickAvatar,
  summarizeDossier,
  type DossierAttachmentRow,
} from '@/lib/portal-external/dossier-summary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portal-external/me
 * Profil de l'artisan + compteurs de missions + avancement du dossier + avatar.
 */
export async function GET(request: Request) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { artisan, supabase } = auth

  try {
    const [interventions, attachmentsRes, artisanRes] = await Promise.all([
      listPortalInterventions(supabase, artisan.id),
      supabase
        .from('artisan_attachments')
        .select('id, artisan_id, kind, url, review_status, created_at, derived_sizes')
        .eq('artisan_id', artisan.id),
      // `dossier_validated_at` n'est pas dans la jointure du jeton : il est posé
      // par le trigger `trg_artisan_dossier_sync` (99078), pas par le portail.
      supabase.from('artisans').select('dossier_validated_at').eq('id', artisan.id).maybeSingle(),
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

    const pieces = (attachmentsRes.data ?? []) as DossierAttachmentRow[]
    const dossierValidatedAt =
      (artisanRes.data as { dossier_validated_at: string | null } | null)?.dossier_validated_at ?? null

    return NextResponse.json({
      artisan,
      counters,
      // `pending` et `rejected` en plus de `present` : la pastille du bouton
      // Profil et la distinction « déposée / validée » (D16) en dépendent.
      documents: summarizeDossier(pieces),
      avatar: pickAvatar(pieces),
      dossier_validated_at: dossierValidatedAt,
    })
  } catch (error) {
    return portalInternalError('me', error)
  }
}
