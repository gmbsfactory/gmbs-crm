import { NextResponse } from 'next/server'
import { authenticatePortalRequest, portalError } from '@/lib/portal-external/auth'
import { portalInternalError, readJsonBody } from '@/lib/portal-external/http'
import { validateEventEnvelope } from '@/lib/portal-external/actions'
import { respondToPrice, validatePriceBody } from '@/lib/portal-external/price'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/portal-external/me/interventions/{id}/price
 *
 * `{ event_uid, occurred_at?, response, amount_seen, reason? }` →
 * `200 { price }`.
 *
 * Verrou optimiste : `amount_seen` doit valoir le coût SST courant de cet
 * artisan, sinon `409 price_changed` avec `current_amount`. Le rejeu d'un
 * `event_uid` déjà connu renvoie `200`, jamais `409`. Ne change jamais le
 * statut de l'intervention.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const envelope = validateEventEnvelope(parsed.body)
  if (!envelope.ok) return portalError(400, envelope.error)

  const input = validatePriceBody(parsed.body)
  if (!input.ok) return portalError(400, input.error)

  try {
    const result = await respondToPrice({
      supabase: auth.supabase,
      artisanId: auth.artisan.id,
      interventionId: id,
      input: input.value,
      source: 'portal',
      envelope: envelope.value,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return portalInternalError('me/interventions/[id]/price', error)
  }
}
