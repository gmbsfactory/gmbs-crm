import { NextResponse } from 'next/server'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { PORTAL_REPORT_COLUMNS, pickPortalReport } from '@/lib/portal-external/interventions'
import { REPORT_REMINDER_MARKER } from '@/lib/portal-external/report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const DECISIONS = ['approved', 'rejected'] as const
type Decision = (typeof DECISIONS)[number]
const MAX_COMMENT_LENGTH = 2000
/** Réouverture demandée au refus : seule transition autorisée par cette route. */
const REOPEN_FROM_STATUS = 'INTER_TERMINEE'
const REOPEN_TO_STATUS = 'INTER_EN_COURS'

/**
 * POST /api/interventions/{id}/portal-report/review  (permission write_interventions)
 * `{ decision, comment?, report_id?, reopen_intervention? }` → `200 { report, intervention }`.
 *
 * Traite le rapport désigné par `report_id` — indispensable dès qu'une
 * intervention porte plusieurs rapports (deux artisans, plusieurs versions) :
 * sans lui, le gestionnaire valide « le rapport que le serveur a choisi », pas
 * celui qu'il regarde. Sans `report_id`, on retombe sur le rapport **en
 * attente** (`pickPortalReport`), comportement historique.
 *
 * `comment` est **obligatoire** au refus : sans motif, l'artisan redépose la
 * même chose et le gestionnaire refait le travail.
 *
 * `reopen_intervention` ramène une intervention `INTER_TERMINEE` en
 * `INTER_EN_COURS` pour que l'artisan puisse renvoyer une version.
 *
 * Clôt uniquement le reminder du rapport (et seulement s'il ne reste aucun
 * autre rapport en attente), ajoute un commentaire système.
 * `has_portal_report` est recalculé par le trigger.
 */
export async function POST(request: Request, { params }: Params) {
  const permCheck = await requirePermission(request, 'write_interventions')
  if (isPermissionError(permCheck)) return permCheck.error
  const reviewer = permCheck.user

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Intervention ID is required' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const decision = body?.decision
  if (typeof decision !== 'string' || !(DECISIONS as readonly string[]).includes(decision)) {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 })
  }
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, MAX_COMMENT_LENGTH) : ''
  if (decision === 'rejected' && !comment) {
    return NextResponse.json({ error: 'Un motif est obligatoire pour demander une correction' }, { status: 400 })
  }
  const requestedReportId = typeof body.report_id === 'string' && body.report_id ? body.report_id : null
  const reopenIntervention = body.reopen_intervention === true

  try {
    const supabase = createServerSupabaseAdmin()

    // Tous les rapports de l'intervention (tous artisans) : on traite celui en
    // attente, jamais « le plus récent » (qui peut être le rapport déjà validé
    // d'un autre artisan sur une intervention à deux artisans).
    const { data: reports, error: reportsError } = await supabase
      .from('artisan_reports')
      .select('id, status, version')
      .eq('intervention_id', id)
      .order('version', { ascending: false })
      .order('submitted_at', { ascending: false })
    if (reportsError) {
      console.error('[portal-report/review] Lecture du rapport échouée :', reportsError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    const all = (reports ?? []) as Array<{ id: string; status: string; version: number }>
    if (all.length === 0) return NextResponse.json({ error: 'Aucun rapport portail pour cette intervention' }, { status: 404 })
    // `report_id` gagne sur la sélection par défaut ; un id étranger à
    // l'intervention est un 409, jamais un 404 révélateur.
    const latest = requestedReportId
      ? all.find((r) => r.id === requestedReportId) ?? null
      : pickPortalReport(all)
    if (!latest) {
      return NextResponse.json({ error: "Ce rapport n'appartient pas à cette intervention" }, { status: 409 })
    }
    if (latest.status !== 'submitted') {
      return NextResponse.json({ error: 'Ce rapport a déjà été traité' }, { status: 409 })
    }
    // Un autre rapport encore en attente (2ᵉ artisan) garde le reminder ouvert.
    const otherPending = all.some((r) => r.id !== latest.id && r.status === 'submitted')

    const reviewedAt = new Date().toISOString()
    const { data: report, error: updateError } = await supabase
      .from('artisan_reports')
      .update({
        status: decision as Decision,
        reviewed_by: reviewer.id,
        reviewed_at: reviewedAt,
        review_comment: comment || null,
      })
      .eq('id', latest.id)
      .select(PORTAL_REPORT_COLUMNS)
      .single()
    if (updateError || !report) {
      console.error('[portal-report/review] Mise à jour du rapport échouée :', updateError?.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Clôture du (seul) reminder de rapport, jamais des autres reminders.
    if (!otherPending) {
      const { error: reminderError } = await supabase
        .from('intervention_reminders')
        .update({ is_active: false, is_completed: true, updated_at: reviewedAt })
        .eq('intervention_id', id)
        .eq('is_active', true)
        .ilike('note', `@%${REPORT_REMINDER_MARKER}%`)
      if (reminderError) console.error('[portal-report/review] Clôture du reminder échouée :', reminderError.message)
    }

    // Réouverture facultative : INTER_TERMINEE → INTER_EN_COURS, pour que
    // l'artisan puisse renvoyer une version. La transition est journalisée par
    // le trigger de 00010 ; on ne touche à rien d'autre sur l'intervention.
    let statutCode: string | null = null
    if (reopenIntervention) {
      const { data: current } = await supabase
        .from('interventions')
        .select('statut_id, statut:intervention_statuses!statut_id ( code )')
        .eq('id', id)
        .maybeSingle()
      const currentStatut = current as { statut_id: string | null; statut: { code: string | null } | { code: string | null }[] | null } | null
      const currentCode = Array.isArray(currentStatut?.statut)
        ? currentStatut?.statut[0]?.code ?? null
        : currentStatut?.statut?.code ?? null
      statutCode = currentCode
      if (currentCode === REOPEN_FROM_STATUS) {
        const { data: target } = await supabase
          .from('intervention_statuses')
          .select('id')
          .eq('code', REOPEN_TO_STATUS)
          .maybeSingle()
        const targetId = (target as { id: string } | null)?.id ?? null
        if (targetId) {
          const { error: reopenError } = await supabase
            .from('interventions')
            .update({ statut_id: targetId })
            .eq('id', id)
          if (reopenError) {
            console.error('[portal-report/review] Réouverture échouée :', reopenError.message)
          } else {
            statutCode = REOPEN_TO_STATUS
          }
        }
      }
    }

    const { data: reviewerRow } = await supabase
      .from('users')
      .select('firstname, lastname, username')
      .eq('id', reviewer.id)
      .maybeSingle()
    const reviewerName =
      [reviewerRow?.firstname, reviewerRow?.lastname].filter(Boolean).join(' ').trim() ||
      reviewerRow?.username ||
      'un gestionnaire'

    const content =
      decision === 'approved'
        ? `Rapport validé par ${reviewerName}${comment ? ` : ${comment}` : ''}`
        : `Rapport refusé par ${reviewerName}${comment ? ` : ${comment}` : ''}`
    const { error: commentError } = await supabase.from('comments').insert({
      entity_type: 'intervention',
      entity_id: id,
      content,
      comment_type: 'system',
      author_id: reviewer.id,
      is_internal: true,
    })
    if (commentError) console.error('[portal-report/review] Commentaire système non créé :', commentError.message)

    return NextResponse.json({ report, intervention: { statut_code: statutCode } })
  } catch (error) {
    console.error('[portal-report/review] Erreur inattendue :', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
