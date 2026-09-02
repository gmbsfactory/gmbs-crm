import { NextResponse } from 'next/server'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { PORTAL_REPORT_COLUMNS } from '@/lib/portal-external/interventions'
import { REPORT_REMINDER_MARKER } from '@/lib/portal-external/report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const DECISIONS = ['approved', 'rejected'] as const
type Decision = (typeof DECISIONS)[number]
const MAX_COMMENT_LENGTH = 2000

/**
 * POST /api/interventions/{id}/portal-report/review  (permission write_interventions)
 * `{ decision: 'approved' | 'rejected', comment? }` → `200 { report }`.
 * Met à jour le rapport (status, reviewed_by, reviewed_at, review_comment),
 * clôt uniquement le reminder du rapport, ajoute un commentaire système.
 * Ne change pas le statut de l'intervention ; `has_portal_report` est
 * recalculé par le trigger.
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

  try {
    const supabase = createServerSupabaseAdmin()

    const { data: latest, error: latestError } = await supabase
      .from('artisan_reports')
      .select('id, status, version')
      .eq('intervention_id', id)
      .order('version', { ascending: false })
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestError) {
      console.error('[portal-report/review] Lecture du rapport échouée :', latestError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (!latest) return NextResponse.json({ error: 'Aucun rapport portail pour cette intervention' }, { status: 404 })
    if (latest.status !== 'submitted') {
      return NextResponse.json({ error: 'Ce rapport a déjà été traité' }, { status: 409 })
    }

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
    const { error: reminderError } = await supabase
      .from('intervention_reminders')
      .update({ is_active: false, is_completed: true, updated_at: reviewedAt })
      .eq('intervention_id', id)
      .eq('is_active', true)
      .ilike('note', `@%${REPORT_REMINDER_MARKER}%`)
    if (reminderError) console.error('[portal-report/review] Clôture du reminder échouée :', reminderError.message)

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

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[portal-report/review] Erreur inattendue :', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
