import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServerSupabaseAdmin, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * POST /api/interventions/[id]/validate-report
 *
 * Validates the portal report and changes status to INTER_TERMINEE.
 * Deactivates associated reminders.
 *
 * Auth: Requires authenticated user (gestionnaire)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Get auth token from cookies or header
  const cookieStore = await cookies()
  const token = bearerFrom(request) || cookieStore.get('sb-access-token')?.value
  const supabaseAuth = createServerSupabase(token || undefined)
  
  // Get authenticated user
  const { data: authUser, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !authUser?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Get user details from users table
  const adminSupabase = createServerSupabaseAdmin()
  const { data: user, error: userError } = await adminSupabase
    .from('users')
    .select('id, firstname, lastname')
    .eq('auth_user_id', authUser.user.id)
    .single()
    
  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  const { id: interventionId } = await params

  try {
    // 1. Vérifier que l'intervention existe et est en INTER_EN_COURS avec rapport
    const { data: intervention, error: intError } = await adminSupabase
      .from('interventions')
      .select(`
        id,
        id_inter,
        statut_id,
        has_portal_report,
        intervention_statuses!interventions_statut_id_fkey (code)
      `)
      .eq('id', interventionId)
      .single()

    if (intError || !intervention) {
      console.error('[validate-report] Intervention not found:', intError)
      return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })
    }

    // Vérifier que l'intervention est en cours et a un rapport
    const statusData = intervention.intervention_statuses as unknown as { code: string } | null
    const statusCode = statusData?.code
    if (statusCode !== 'INTER_EN_COURS') {
      return NextResponse.json(
        { error: 'Intervention is not in INTER_EN_COURS status' },
        { status: 400 }
      )
    }

    if (!intervention.has_portal_report) {
      return NextResponse.json(
        { error: 'No portal report found for this intervention' },
        { status: 400 }
      )
    }

    // 2. Récupérer le statut INTER_TERMINEE
    const { data: termineeStatus, error: statusError } = await adminSupabase
      .from('intervention_statuses')
      .select('id')
      .eq('code', 'INTER_TERMINEE')
      .single()

    if (statusError || !termineeStatus) {
      console.error('[validate-report] Status INTER_TERMINEE not found:', statusError)
      return NextResponse.json({ error: 'Status configuration error' }, { status: 500 })
    }

    // 3. Mettre à jour l'intervention : passer à TERMINEE et garder le flag rapport
    const { error: updateError } = await adminSupabase
      .from('interventions')
      .update({
        statut_id: termineeStatus.id,
        has_portal_report: true,  // Garder le flag (déjà true normalement)
        date_termine: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('id', interventionId)

    if (updateError) {
      console.error('[validate-report] Failed to update intervention:', updateError)
      return NextResponse.json({ error: 'Failed to update intervention' }, { status: 500 })
    }

    // 4. Désactiver tous les reminders actifs pour cette intervention
    const { error: reminderError } = await adminSupabase
      .from('intervention_reminders')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('intervention_id', interventionId)
      .eq('is_active', true)

    if (reminderError) {
      console.error('[validate-report] Failed to deactivate reminders:', reminderError)
      // Ne pas bloquer - continuer quand même
    }

    // 5. Logger l'action dans les commentaires
    await adminSupabase
      .from('comments')
      .insert({
        entity_type: 'intervention',
        entity_id: interventionId,
        author_id: user.id,
        content: `Rapport d'intervention validé par ${user.firstname} ${user.lastname}. Intervention terminée.`,
        comment_type: 'system',
        is_internal: true,
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: 'Report validated and intervention completed'
    })

  } catch (error) {
    console.error('[validate-report] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
