import { NextResponse } from 'next/server'
import { isPermissionError, requirePermission } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { startWork } from '@/lib/portal-external/work-start'
import { resolveActorLabel } from '@/lib/portal-external/actor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; artisanId: string }> }

/**
 * PATCH /api/interventions/{id}/artisans/{artisanId}/start  (write_interventions)
 *
 * **Repli gestionnaire** : « chantier démarré, l'artisan me l'a dit au
 * téléphone ». Même chemin que la route du portail — donc mêmes gardes, même
 * écriture du fait avant toute projection, même tentative de bascule
 * `ACCEPTE → INTER_EN_COURS` — avec `work_started_from = 'crm'`.
 *
 * `started_at` est facultatif : absent, c'est l'instant de la saisie. Une date
 * aberrante n'est pas rejetée, elle est recalée (§4.1).
 */
export async function PATCH(request: Request, { params }: Params) {
  const permCheck = await requirePermission(request, 'write_interventions')
  if (isPermissionError(permCheck)) return permCheck.error

  const { id, artisanId } = await params
  if (!id || !artisanId) {
    return NextResponse.json({ error: 'Intervention and artisan ids are required' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await request.json()) as Record<string, unknown>) ?? {}
  } catch {
    // Corps vide accepté : « démarré maintenant ».
    body = {}
  }

  const startedAt = body.started_at
  if (startedAt !== undefined && startedAt !== null && typeof startedAt !== 'string') {
    return NextResponse.json({ error: 'started_at must be an ISO string' }, { status: 400 })
  }

  try {
    const supabase = createServerSupabaseAdmin()
    const result = await startWork({
      supabase,
      artisanId,
      interventionId: id,
      source: 'crm',
      startedAt: typeof startedAt === 'string' ? startedAt : null,
      actor: { userId: permCheck.user.id, label: await resolveActorLabel(supabase, permCheck.user.id) },
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('[interventions/artisans/start] PATCH failed', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
