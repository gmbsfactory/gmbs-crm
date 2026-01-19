import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { validatePortalApiRequest } from '@/lib/portal-external/auth'

/**
 * GET /api/portal-external/artisan/[artisanId]/interventions
 * 
 * Returns interventions assigned to an artisan.
 * Called by portal_gmbs to display artisan's interventions.
 * 
 * Auth: X-GMBS-Key-Id + X-GMBS-Secret headers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artisanId: string }> }
) {
  // Validate portal API credentials
  const authResult = await validatePortalApiRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { artisanId } = await params

  try {
    const supabase = createServerSupabaseAdmin()

    // First, verify artisan exists
    const { data: artisan, error: artisanError } = await supabase
      .from('artisans')
      .select('id, nom, prenom')
      .eq('id', artisanId)
      .single()

    if (artisanError) {
      console.error('[portal-external] Error fetching artisan:', artisanError)
      return NextResponse.json({ 
        error: 'Artisan not found', 
        details: artisanError.message,
        code: artisanError.code
      }, { status: 404 })
    }

    // Get interventions where this artisan is assigned via intervention_artisans table
    const { data: assignments, error: assignError } = await supabase
      .from('intervention_artisans')
      .select('intervention_id')
      .eq('artisan_id', artisanId)

    if (assignError) {
      console.error('[portal-external] Error fetching assignments:', assignError)
      return NextResponse.json({ 
        error: 'Database error', 
        details: assignError.message,
        code: assignError.code,
        hint: assignError.hint,
        table: 'intervention_artisans'
      }, { status: 500 })
    }

    const interventionIds = (assignments || []).map(a => a.intervention_id)

    if (interventionIds.length === 0) {
      return NextResponse.json({ interventions: [], count: 0 })
    }

    const { data: interventions, error } = await supabase
      .from('interventions')
      .select(`
        id,
        id_inter,
        adresse,
        code_postal,
        ville,
        contexte_intervention,
        consigne_intervention,
        date,
        due_date,
        created_at,
        updated_at,
        statut:statut_id(code, label, color),
        metier:metier_id(label),
        agence:agence_id(nom)
      `)
      .in('id', interventionIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[portal-external] Error fetching interventions:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Map to a clean format for the portal
    const mapped = (interventions || []).map((i: Record<string, unknown>) => {
      const statut = i.statut as { code?: string; label?: string; color?: string } | null
      const metier = i.metier as { label?: string } | null
      const agence = i.agence as { nom?: string } | null
      
      return {
        id: i.id,
        idInter: i.id_inter,
        address: i.adresse,
        postalCode: i.code_postal,
        city: i.ville,
        context: i.contexte_intervention,
        consigne: i.consigne_intervention,
        status: statut?.code || null,
        statusCode: mapStatusToCode(statut?.code || ''),
        statusLabel: statut?.label || mapStatusToLabel(statut?.code || ''),
        statusColor: statut?.color || null,
        date: i.date,
        dueAt: i.due_date,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        metier: metier?.label || null,
        agency: agence?.nom || null
      }
    })

    return NextResponse.json({
      interventions: mapped,
      count: mapped.length
    })

  } catch (error) {
    console.error('[portal-external] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Map CRM status to user-friendly labels
function mapStatusToCode(status: string): string {
  const map: Record<string, string> = {
    'DEMANDE': 'pending',
    'DEVIS_ENVOYE': 'quote_sent',
    'VISITE_TECHNIQUE': 'technical_visit',
    'REFUSE': 'refused',
    'ANNULE': 'cancelled',
    'STAND_BY': 'on_hold',
    'ACCEPTE': 'accepted',
    'INTER_EN_COURS': 'in_progress',
    'INTER_TERMINEE': 'completed',
    'SAV': 'after_sales',
    'ATT_ACOMPTE': 'awaiting_deposit',
    'POTENTIEL': 'potential'
  }
  return map[status] || 'unknown'
}

function mapStatusToLabel(status: string): string {
  const map: Record<string, string> = {
    'DEMANDE': 'Demande',
    'DEVIS_ENVOYE': 'Devis envoyé',
    'VISITE_TECHNIQUE': 'Visite technique',
    'REFUSE': 'Refusé',
    'ANNULE': 'Annulé',
    'STAND_BY': 'En attente',
    'ACCEPTE': 'Accepté',
    'INTER_EN_COURS': 'En cours',
    'INTER_TERMINEE': 'Terminée',
    'SAV': 'SAV',
    'ATT_ACOMPTE': 'Attente acompte',
    'POTENTIEL': 'Potentiel'
  }
  return map[status] || status
}
// Force redeploy Mon Jan 19 21:04:15 CET 2026
