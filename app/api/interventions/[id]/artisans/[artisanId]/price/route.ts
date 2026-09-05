import { NextResponse } from 'next/server'
import { isPermissionError, requirePermission } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { respondToPrice, validatePriceBody } from '@/lib/portal-external/price'
import { resolveActorLabel } from '@/lib/portal-external/actor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; artisanId: string }> }

/**
 * PATCH /api/interventions/{id}/artisans/{artisanId}/price  (write_interventions)
 *
 * **Repli gestionnaire** : « l'artisan a accepté / refusé par téléphone ».
 * Sans lui, un artisan sans smartphone ne franchirait jamais la garde de
 * `POST /start`, et la vision entière deviendrait inapplicable pour une partie
 * du réseau. La réponse est identique à celle du portail, à ceci près que
 * `price_response_source` vaut `crm`, que `price_response_by` porte le
 * gestionnaire, et que la réécriture d'une réponse déjà donnée est autorisée
 * (question Q5 : le gestionnaire corrige, avec trace au journal).
 */
export async function PATCH(request: Request, { params }: Params) {
  const permCheck = await requirePermission(request, 'write_interventions')
  if (isPermissionError(permCheck)) return permCheck.error

  const { id, artisanId } = await params
  if (!id || !artisanId) {
    return NextResponse.json({ error: 'Intervention and artisan ids are required' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = validatePriceBody(body ?? {})
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 })

  try {
    const supabase = createServerSupabaseAdmin()
    const result = await respondToPrice({
      supabase,
      artisanId,
      interventionId: id,
      input: input.value,
      source: 'crm',
      actor: { userId: permCheck.user.id, label: await resolveActorLabel(supabase, permCheck.user.id) },
      allowOverwrite: true,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('[interventions/artisans/price] PATCH failed', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
