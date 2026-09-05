import { NextResponse } from 'next/server'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { PORTAL_REPORT_COLUMNS, pickPortalReport } from '@/lib/portal-external/interventions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

interface ArtisanRef {
  id: string
  nom: string | null
  prenom: string | null
}

/**
 * Colonnes de `artisan_reports` ajoutées par la migration 99078 (socle portail v2)
 * et absentes de `PORTAL_REPORT_COLUMNS`, qui décrit le contrat **portail**.
 * Elles n'ont de sens que pour le CRM : durée réelle et chaîne des versions.
 */
const REPORT_CRM_COLUMNS = 'started_at, superseded_at, superseded_by'

/** Clé de `photosByReport` regroupant les photos rattachées à aucune version. */
export const PHOTOS_HORS_RAPPORT = '_hors_rapport'

type ReportRow = Record<string, unknown> & {
  id: string
  status: string
  version: number
  submitted_at: string | null
  attachment_ids: string[] | null
  artisan_id: string | null
  artisan: ArtisanRef | ArtisanRef[] | null
}

interface AssignmentRow {
  artisan_id: string | null
  is_primary: boolean | null
  role: string | null
  price_response: string | null
  price_responded_at: string | null
  price_accepted_amount: number | string | null
  price_refused_reason: string | null
  price_response_source: string | null
  work_started_at: string | null
  work_started_from: string | null
  payment_status: string | null
  paid_at: string | null
  artisan: ArtisanRef | ArtisanRef[] | null
}

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function timeOf(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

/**
 * Ordre d'affichage des rapports : le(s) rapport(s) **en attente** d'abord
 * (même règle que `pickPortalReport`, promue de l'API vers l'UI), puis par
 * date d'envoi décroissante, la version la plus haute départageant.
 */
export function sortPortalReports<T extends { status: string; submitted_at: string | null; version: number }>(
  reports: readonly T[],
): T[] {
  return [...reports].sort((a, b) => {
    const pending = Number(b.status === 'submitted') - Number(a.status === 'submitted')
    if (pending !== 0) return pending
    const submitted = timeOf(b.submitted_at) - timeOf(a.submitted_at)
    if (submitted !== 0) return submitted
    return (b.version ?? 0) - (a.version ?? 0)
  })
}

/**
 * GET /api/interventions/{id}/portal-report  (permission read_interventions)
 *
 * Renvoie, pour le panneau « Rapport » du modal :
 * - `report`, `photos`, `artisan` — **conservés à l'identique** (rétro-compat :
 *   `report` reste `pickPortalReport(reports)`) ;
 * - `reports[]` — tous les rapports de l'intervention, tous artisans et toutes
 *   versions, triés (en attente d'abord, puis date décroissante) ;
 * - `photosByReport{}` — les photos ventilées par version, les orphelines sous
 *   la clé `_hors_rapport` ; sans elle la visionneuse mélangerait les versions ;
 * - `assignments[]` — l'état de chaque artisan affecté (prix proposé / accepté /
 *   refusé, démarrage du chantier, paiement), qui alimente les sept états du
 *   panneau même quand aucun rapport n'existe.
 */
export async function GET(request: Request, { params }: Params) {
  const permCheck = await requirePermission(request, 'read_interventions')
  if (isPermissionError(permCheck)) return permCheck.error

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Intervention ID is required' }, { status: 400 })

  try {
    const supabase = createServerSupabaseAdmin()

    const { data: intervention, error: interventionError } = await supabase
      .from('interventions')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (interventionError) {
      console.error('[portal-report] Lecture de l\'intervention échouée :', interventionError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (!intervention) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

    const [reportRes, photosRes, assignmentsRes, costsRes] = await Promise.all([
      supabase
        .from('artisan_reports')
        .select(
          `artisan_id, artisan:artisans!artisan_id ( id, nom, prenom ), ${PORTAL_REPORT_COLUMNS}, ${REPORT_CRM_COLUMNS}`,
        )
        .eq('intervention_id', id)
        .order('version', { ascending: false })
        .order('submitted_at', { ascending: false }),
      supabase
        .from('intervention_attachments')
        .select('id, url, filename, created_at, created_by_display, metadata')
        .eq('intervention_id', id)
        .eq('kind', 'photos')
        .eq('metadata->>source', 'portal')
        .order('created_at', { ascending: true }),
      supabase
        .from('intervention_artisans')
        .select(
          `artisan_id, is_primary, role, price_response, price_responded_at, price_accepted_amount,
           price_refused_reason, price_response_source, work_started_at, work_started_from,
           payment_status, paid_at, artisan:artisans!artisan_id ( id, nom, prenom )`,
        )
        .eq('intervention_id', id)
        .order('is_primary', { ascending: false }),
      supabase
        .from('intervention_costs')
        .select('amount, artisan_order')
        .eq('intervention_id', id)
        .eq('cost_type', 'sst'),
    ])

    if (reportRes.error) {
      console.error('[portal-report] Lecture du rapport échouée :', reportRes.error.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const rows = sortPortalReports((reportRes.data ?? []) as unknown as ReportRow[])

    // Coût SST par artisan_order (1 = principal, 2 = second). Une seule ligne
    // sans artisan_order vaut pour l'artisan principal (cf. mapIntervention).
    const sstByOrder = new Map<number, number>()
    for (const cost of (costsRes.data ?? []) as Array<{ amount: number | string | null; artisan_order: number | null }>) {
      const amount = toNumber(cost.amount)
      if (amount !== null) sstByOrder.set(cost.artisan_order ?? 1, amount)
    }

    // reports[] : le rapport porte son artisan résolu, jamais la relation brute.
    const reports = rows.map((row) => {
      const { artisan_id: artisanId, artisan: artisanRel, ...rest } = row
      return { ...rest, artisan: one(artisanRel), artisan_id: artisanId }
    })

    // photosByReport{} : ventilation par version depuis attachment_ids ; une
    // photo citée par aucune version tombe dans `_hors_rapport`.
    const photos = (photosRes.data ?? []) as Array<{ id: string }>
    const photosByReport: Record<string, string[]> = {}
    const claimed = new Set<string>()
    const knownPhotoIds = new Set(photos.map((photo) => photo.id))
    for (const row of rows) {
      const ids = (row.attachment_ids ?? []).filter((photoId) => knownPhotoIds.has(photoId))
      photosByReport[row.id] = ids
      for (const photoId of ids) claimed.add(photoId)
    }
    const orphans = photos.filter((photo) => !claimed.has(photo.id)).map((photo) => photo.id)
    if (orphans.length > 0) photosByReport[PHOTOS_HORS_RAPPORT] = orphans

    // assignments[] : un élément par artisan affecté, dans l'ordre principal puis second.
    const reportIdsByArtisan = new Map<string, string[]>()
    for (const row of rows) {
      if (!row.artisan_id) continue
      const list = reportIdsByArtisan.get(row.artisan_id) ?? []
      list.push(row.id)
      reportIdsByArtisan.set(row.artisan_id, list)
    }

    const assignmentRows = (assignmentsRes.data ?? []) as unknown as AssignmentRow[]
    const assignments = assignmentRows.map((row, index) => {
      const order = row.is_primary === false ? 2 : row.is_primary ? 1 : index + 1
      const coutSst = sstByOrder.get(order) ?? (sstByOrder.size === 1 && order === 1 ? sstByOrder.values().next().value ?? null : null)
      const acceptedAmount = toNumber(row.price_accepted_amount)
      return {
        artisan: one(row.artisan),
        artisan_id: row.artisan_id,
        is_primary: row.is_primary ?? false,
        cout_sst: coutSst ?? null,
        price: {
          response: row.price_response,
          responded_at: row.price_responded_at,
          accepted_amount: acceptedAmount,
          source: row.price_response_source,
          refused_reason: row.price_refused_reason,
          // Le prix accepté a bougé depuis le oui de l'artisan (modale e-mail).
          drift: acceptedAmount !== null && coutSst !== null && coutSst !== undefined && acceptedAmount !== coutSst,
        },
        work: { started_at: row.work_started_at, from: row.work_started_from },
        payment: { state: row.payment_status ?? 'not_applicable', paid_at: row.paid_at },
        report_ids: row.artisan_id ? reportIdsByArtisan.get(row.artisan_id) ?? [] : [],
      }
    })

    // report / artisan : sélection par défaut, inchangée (rétro-compat).
    let report: Record<string, unknown> | null = null
    let artisan: ArtisanRef | null = null
    const selected = pickPortalReport(rows)
    if (selected) {
      const { artisan_id: _artisanId, artisan: artisanRel, ...rest } = selected
      void _artisanId
      report = rest
      artisan = one(artisanRel)
    } else {
      // Pas de rapport : on renvoie l'artisan principal pour l'affichage.
      const primary = assignments.find((item) => item.is_primary) ?? assignments[0] ?? null
      artisan = primary?.artisan ?? null
    }

    return NextResponse.json({
      report,
      photos: photosRes.data ?? [],
      artisan,
      reports,
      photosByReport,
      assignments,
    })
  } catch (error) {
    console.error('[portal-report] Erreur inattendue :', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
