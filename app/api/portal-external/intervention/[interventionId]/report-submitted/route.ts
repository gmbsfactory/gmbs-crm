import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { validatePortalApiRequest } from '@/lib/portal-external/auth'

/**
 * POST /api/portal-external/intervention/[interventionId]/report-submitted
 *
 * Called by portal_gmbs when artisan submits a report.
 *
 * Actions:
 * 1. Mark intervention with has_portal_report flag (NO status change)
 * 2. Create a reminder with mention for the assigned gestionnaire
 *
 * Auth: Portal API Key (validated via portal-external/auth)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ interventionId: string }> }
) {
  // Valider la requête depuis le portal
  const authResult = await validatePortalApiRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { interventionId } = await params
  const body = await request.json()
  const { artisanId, reportId, reportContent, photoCount } = body

  if (!artisanId) {
    return NextResponse.json({ error: 'artisanId required' }, { status: 400 })
  }

  const supabase = createServerSupabaseAdmin()

  try {
    // 1. Récupérer l'intervention avec ses relations (incluant le gestionnaire assigné si présent)
    const { data: intervention, error: intError } = await supabase
      .from('interventions')
      .select(`
        id,
        id_inter,
        assigned_user_id,
        statut_id,
        artisan_id,
        artisan:artisans (
          id,
          prenom,
          nom
        )
      `)
      .eq('id', interventionId)
      .single()

    // Récupérer le gestionnaire assigné séparément (optionnel)
    let assignedUser: { id: string; username: string; firstname: string | null; lastname: string | null } | null = null
    if (intervention?.assigned_user_id) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, username, firstname, lastname')
        .eq('id', intervention.assigned_user_id)
        .single()
      assignedUser = userData
    }

    if (intError || !intervention) {
      console.error('[report-submitted] Intervention not found:', intError)
      return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })
    }

    // 2. Vérifier que l'artisan correspond
    if (intervention.artisan_id !== artisanId) {
      console.error('[report-submitted] Artisan mismatch:', {
        expected: intervention.artisan_id,
        received: artisanId
      })
      return NextResponse.json({ error: 'Artisan mismatch' }, { status: 403 })
    }

    // 3. Marquer l'intervention comme ayant un rapport (PAS de changement de statut)
    const { error: updateError } = await supabase
      .from('interventions')
      .update({
        has_portal_report: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', interventionId)

    if (updateError) {
      console.error('[report-submitted] Failed to update has_portal_report flag:', updateError)
      return NextResponse.json({ error: 'Failed to update intervention' }, { status: 500 })
    }

    // 4. Construire le nom de l'artisan
    const artisanRecord = intervention.artisan as unknown as { id: string; prenom: string | null; nom: string | null } | null
    const artisanName = artisanRecord
      ? [artisanRecord.prenom, artisanRecord.nom].filter(Boolean).join(' ')
      : 'Artisan'

    // 5. Construire le nom/username du gestionnaire assigné pour la mention
    const gestionnaireUsername = assignedUser?.username || 'gestionnaire'
    const gestionnaireName = assignedUser
      ? [assignedUser.firstname, assignedUser.lastname].filter(Boolean).join(' ') || assignedUser.username
      : 'Gestionnaire'

    // 6. Créer un reminder pour le gestionnaire assigné avec mention @username
    if (intervention.assigned_user_id) {
      // Format: @username pour déclencher la notification realtime
      const interRef = intervention.id_inter || 'INT-' + interventionId.slice(0, 8)
      const reminderNote = `@${gestionnaireUsername} 📋 Rapport de l'inter #${interRef} à vérifier - soumis par ${artisanName}. ${photoCount ? `${photoCount} photo(s) jointe(s).` : ''}`

      // Vérifier s'il existe déjà un reminder actif pour cette intervention
      const { data: existingReminder, error: existingReminderError } = await supabase
        .from('intervention_reminders')
        .select('id')
        .eq('intervention_id', interventionId)
        .eq('user_id', intervention.assigned_user_id)
        .eq('is_active', true)
        .maybeSingle()

      if (existingReminderError) {
        console.error('[report-submitted] Error checking existing reminder:', existingReminderError)
      }

      if (existingReminder) {
        // Mettre à jour le reminder existant avec nouvelle mention
        const { error: updateReminderError } = await supabase
          .from('intervention_reminders')
          .update({
            note: reminderNote,
            updated_at: new Date().toISOString(),
            mentioned_user_ids: [intervention.assigned_user_id]  // Re-mention pour nouvelle notification realtime
          })
          .eq('id', existingReminder.id)

        if (updateReminderError) {
          console.error('[report-submitted] Failed to update reminder:', updateReminderError)
        }
      } else {
        // Créer un nouveau reminder avec mention du gestionnaire
        // Le gestionnaire est à la fois user_id et dans mentioned_user_ids
        // RemindersContext affichera le toast car il est dans mentioned_user_ids
        const { error: insertReminderError } = await supabase
          .from('intervention_reminders')
          .insert({
            intervention_id: interventionId,
            user_id: intervention.assigned_user_id,
            note: reminderNote,
            is_active: true,
            mentioned_user_ids: [intervention.assigned_user_id]  // Mention = notification realtime
          })

        if (insertReminderError) {
          console.error('[report-submitted] Failed to create reminder:', insertReminderError)
        }
      }
    }

    // 7. Logger l'action dans les commentaires
    await supabase
      .from('comments')
      .insert({
        entity_type: 'intervention',
        entity_id: interventionId,
        content: `Rapport d'intervention reçu de l'artisan ${artisanName}. En attente de validation.`,
        comment_type: 'system',
        is_internal: true,
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: 'Report received and notification created'
    })

  } catch (error) {
    console.error('[report-submitted] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
