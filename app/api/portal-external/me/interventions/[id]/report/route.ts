import { NextResponse } from 'next/server'
import { authenticatePortalRequest, portalError } from '@/lib/portal-external/auth'
import { portalInternalError, readJsonBody } from '@/lib/portal-external/http'
import { getPortalIntervention } from '@/lib/portal-external/interventions'
import {
  optionalEventEnvelope,
  patchPortalReport,
  submitPortalReport,
  validateReportBody,
  validateReportPatchBody,
} from '@/lib/portal-external/report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/portal-external/me/interventions/{id}/report
 * Dernier rapport de l'artisan pour cette mission → `{ report | null }`.
 * L'historique complet des versions est servi par `…/reports` (§4.2).
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  try {
    const result = await getPortalIntervention(auth.supabase, auth.artisan.id, id)
    if (!result) return portalError(404, 'Intervention not found')
    return NextResponse.json({ report: result.report })
  } catch (error) {
    return portalInternalError('me/interventions/[id]/report GET', error)
  }
}

/**
 * POST /api/portal-external/me/interventions/{id}/report
 * Envoi (idempotent sur `portal_report_id`) d'une version du rapport.
 *
 * `replaces` porte l'identifiant du rapport encore en attente que cet envoi
 * remplace : la version précédente passe à `superseded`, la nouvelle prend le
 * numéro suivant (§7.3). 201 création, 200 rejeu, 404 non affecté,
 * 409 `report_pending` / `report_not_replaceable` / `report_already_approved`
 * ou statut d'intervention incompatible.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const envelope = optionalEventEnvelope(parsed.body)
  if (!envelope.ok) return portalError(400, envelope.error)

  const validation = validateReportBody(parsed.body)
  if (!validation.ok) return portalError(400, validation.error)

  try {
    const result = await submitPortalReport({
      supabase: auth.supabase,
      artisan: auth.artisan,
      interventionId: id,
      input: validation.value,
      envelope: envelope.value,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return portalInternalError('me/interventions/[id]/report POST', error)
  }
}

/**
 * PATCH /api/portal-external/me/interventions/{id}/report
 * Correction **en place** du rapport encore en attente : tous les champs sont
 * facultatifs, aucun nouveau numéro de version (§7.3).
 * 200 modifié, 404 non affecté ou aucun rapport, 409 `report_already_approved`
 * (validé, donc verrouillé) ou `report_not_editable` (refusé : passer par POST).
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const envelope = optionalEventEnvelope(parsed.body)
  if (!envelope.ok) return portalError(400, envelope.error)

  const validation = validateReportPatchBody(parsed.body)
  if (!validation.ok) return portalError(400, validation.error)

  try {
    const result = await patchPortalReport({
      supabase: auth.supabase,
      artisan: auth.artisan,
      interventionId: id,
      input: validation.value,
      envelope: envelope.value,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return portalInternalError('me/interventions/[id]/report PATCH', error)
  }
}
