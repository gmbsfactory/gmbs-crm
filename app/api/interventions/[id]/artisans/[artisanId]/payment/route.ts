import { NextResponse } from 'next/server'
import { isPermissionError, requirePermission } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { parseArtisanPaymentBody } from '@/lib/interventions/artisan-payment'
import { describePaymentStatus } from '@/lib/interventions/payment-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; artisanId: string }> }

/**
 * PATCH /api/interventions/{id}/artisans/{artisanId}/payment  (write_interventions)
 *
 * `{ payment_status, paid_at? }` → `200 { payment:{ state, label, tone, paid_at, updated_at } }`.
 *
 * Saisie du gestionnaire depuis la page Comptabilité, **par ligne
 * d'affectation** : deux artisans sur une intervention ont deux paiements
 * distincts, ce qu'`intervention_payments.acompte_sst` ne sait pas exprimer
 * (aucun `artisan_order`).
 *
 * **`intervention_payments.is_received` n'est jamais lu ni écrit ici** : c'est
 * l'encaissement *client*. Le seul lien entre les deux serait un raccourci
 * dangereux — « le client a payé GMBS » ne veut pas dire « l'artisan a été payé ».
 *
 * Le libellé rendu est celui du module pur `payment-status.ts`, le même que
 * celui envoyé à l'application artisan : un état ne doit pas s'écrire deux fois.
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
    body = ((await request.json()) as Record<string, unknown>) ?? {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseArtisanPaymentBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  try {
    const supabase = createServerSupabaseAdmin()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('intervention_artisans')
      .update({
        payment_status: parsed.value.payment_status,
        paid_at: parsed.value.paid_at,
        payment_updated_by: permCheck.user.id,
        payment_updated_at: now,
      })
      .eq('intervention_id', id)
      .eq('artisan_id', artisanId)
      .select('payment_status, paid_at, payment_updated_at')
      .maybeSingle()

    if (error) {
      console.error('[interventions/artisans/payment] Mise à jour échouée :', error.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    // Aucune ligne : l'artisan n'est pas affecté à cette intervention. 404
    // uniforme, comme partout ailleurs — jamais un 403 qui confirmerait
    // l'existence de l'intervention.
    if (!data) return NextResponse.json({ error: 'Affectation introuvable' }, { status: 404 })

    const row = data as { payment_status: string; paid_at: string | null; payment_updated_at: string | null }
    const display = describePaymentStatus(row.payment_status, row.paid_at)

    return NextResponse.json({
      payment: {
        state: display.state,
        label: display.label,
        tone: display.tone,
        paid_at: row.paid_at,
        updated_at: row.payment_updated_at,
      },
    })
  } catch (error) {
    console.error('[interventions/artisans/payment] PATCH failed', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
