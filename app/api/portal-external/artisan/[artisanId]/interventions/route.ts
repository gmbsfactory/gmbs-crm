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

    // Get interventions where this artisan is assigned
    const { data: interventions, error } = await supabase
      .from('interventions')
      .select(`
        id,
        name,
        address,
        context,
        consigne,
        status,
        status_changed_at,
        due_at,
        created_at,
        updated_at,
        agency
      `)
      .eq('artisan_id', artisanId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[portal-external] Error fetching interventions:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Map to a clean format for the portal
    const mapped = (interventions || []).map(i => ({
      id: i.id,
      name: i.name,
      address: i.address,
      context: i.context,
      consigne: i.consigne,
      status: i.status,
      statusCode: mapStatusToCode(i.status),
      statusLabel: mapStatusToLabel(i.status),
      statusChangedAt: i.status_changed_at,
      dueAt: i.due_at,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      agency: i.agency
    }))

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
