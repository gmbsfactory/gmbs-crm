import { NextResponse } from 'next/server'
import { authenticatePortalRequest, portalError } from '@/lib/portal-external/auth'
import { portalInternalError, readJsonBody } from '@/lib/portal-external/http'
import { validateEventEnvelope } from '@/lib/portal-external/actions'
import { startWork } from '@/lib/portal-external/work-start'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/portal-external/me/interventions/{id}/start
 *
 * `{ event_uid, occurred_at? }` →
 * `200 { work, statut_code, status_advanced, missing_fields }`.
 *
 * Le démarrage est **toujours** enregistré (règle P3) ; la bascule
 * `ACCEPTE → INTER_EN_COURS` n'est qu'une tentative, et son échec se lit dans
 * `status_advanced` et `missing_fields` — jamais dans un code d'erreur.
 * Idempotent : un second appel renvoie la date déjà posée.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const envelope = validateEventEnvelope(parsed.body)
  if (!envelope.ok) return portalError(400, envelope.error)

  try {
    const result = await startWork({
      supabase: auth.supabase,
      artisanId: auth.artisan.id,
      interventionId: id,
      source: 'portal',
      envelope: envelope.value,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return portalInternalError('me/interventions/[id]/start', error)
  }
}
