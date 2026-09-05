import { NextResponse } from 'next/server'
import { isPermissionError, requirePermission } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import {
  deriveReportEvents,
  mapJournalRow,
  mergeTimelineEvents,
  parseTimelineLimit,
  type ArtisanTimelineEvent,
  type TimelineJournalRow,
  type TimelineReportRow,
} from '@/lib/artisans/portal-timeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const JOURNAL_SELECT = `
  id, action_type, source, occurred_at, recorded_at, payload, report_id, attachment_id,
  intervention:interventions!intervention_id ( id, id_inter ),
  actor:users!actor_user_id ( firstname, lastname, username, email )
`

const REPORT_SELECT = `
  id, intervention_id, version, status, submitted_at,
  intervention:interventions!intervention_id ( id, id_inter )
`

/**
 * GET /api/artisans/{id}/timeline?limit=&before=  (read_artisans)
 *
 * Frise des actions de l'artisan : `{ events[], next_before }`, du plus récent
 * au plus ancien. C'est la réponse à « qui a fait quoi, et quand » — prix
 * accepté, chantier démarré, rapport envoyé, pièce déposée — avec l'acteur et
 * la **source** (`portal` = geste de l'artisan, `crm` = saisie du gestionnaire).
 *
 * `before` est un curseur sur `occurred_at`, pas un numéro de page : le journal
 * est append-only, une pagination par décalage sauterait des lignes dès qu'une
 * action s'écrit pendant la lecture.
 */
export async function GET(request: Request, { params }: Params) {
  const permCheck = await requirePermission(request, 'read_artisans')
  if (isPermissionError(permCheck)) return permCheck.error

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Artisan ID requis' }, { status: 400 })

  const url = new URL(request.url)
  const limit = parseTimelineLimit(url.searchParams.get('limit'))
  const before = url.searchParams.get('before')

  try {
    const supabase = createServerSupabaseAdmin()

    const { data: artisanRow } = await supabase
      .from('artisans')
      .select('id, prenom, nom, raison_sociale')
      .eq('id', id)
      .maybeSingle()
    if (!artisanRow) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })

    const artisan = artisanRow as { prenom: string | null; nom: string | null; raison_sociale: string | null }
    const artisanLabel =
      [artisan.prenom, artisan.nom].filter(Boolean).join(' ').trim() || artisan.raison_sociale || "l'artisan"

    let journalQuery = supabase
      .from('artisan_portal_actions')
      .select(JOURNAL_SELECT)
      .eq('artisan_id', id)
      .order('occurred_at', { ascending: false })
      .limit(limit + 1)
    if (before) journalQuery = journalQuery.lt('occurred_at', before)

    let reportQuery = supabase
      .from('artisan_reports')
      .select(REPORT_SELECT)
      .eq('artisan_id', id)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(limit + 1)
    if (before) reportQuery = reportQuery.lt('submitted_at', before)

    const [journalRes, reportRes] = await Promise.all([journalQuery, reportQuery])

    if (journalRes.error) {
      console.error('[artisans/timeline] Lecture du journal échouée :', journalRes.error.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const journalRows = (journalRes.data ?? []) as unknown as TimelineJournalRow[]
    const journal: ArtisanTimelineEvent[] = journalRows.map((row) => mapJournalRow(row, artisanLabel))

    // Repli de lecture : les rapports que le journal ne porte pas encore. Une
    // erreur ici n'est pas fatale — la frise reste juste, seulement plus courte.
    const dejaJournalises = new Set(journal.map((e) => e.report_id).filter((v): v is string => !!v))
    const derived = reportRes.error
      ? []
      : deriveReportEvents((reportRes.data ?? []) as unknown as TimelineReportRow[], dejaJournalises, artisanLabel)

    const events = mergeTimelineEvents(journal, derived, limit)
    const complet = journal.length + derived.length > events.length
    const next_before = complet && events.length > 0 ? events[events.length - 1].occurred_at : null

    return NextResponse.json({ events, next_before })
  } catch (error) {
    console.error('[artisans/timeline] Erreur inattendue :', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
