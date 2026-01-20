import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { validatePortalApiRequest } from '@/lib/portal-external/auth'

/**
 * GET /api/portal-external/artisan/[artisanId]/interventions
 * 
 * Returns interventions assigned to an artisan with enriched data.
 * Called by portal_gmbs to display artisan's interventions.
 * 
 * Auth: X-GMBS-Key-Id + X-GMBS-Secret headers
 * 
 * Response includes:
 * - id_inter: readable intervention ID
 * - address, city, postal_code: location
 * - client_name: agency/client name
 * - owner_name, owner_phone: property owner info
 * - metier: trade/profession
 * - consigne: instructions for artisan
 * - status info with code and label
 * - document counts (photos_count, has_devis, has_facture_artisan)
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

    // Fetch interventions with related data (owner, tenant, metier, status, assigned_user)
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
        date_prevue,
        due_date,
        created_at,
        updated_at,
        statut_id,
        metier_id,
        agence_id,
        owner_id,
        tenant_id,
        assigned_user_id,
        owner:owner_id (
          id,
          owner_firstname,
          owner_lastname,
          telephone
        ),
        tenant:tenant_id (
          id,
          firstname,
          lastname,
          plain_nom_client,
          telephone
        ),
        assigned_user:assigned_user_id (
          id,
          firstname,
          lastname,
          email
        ),
        metiers:metier_id (
          id,
          label
        ),
        intervention_statuses:statut_id (
          id,
          code,
          label
        )
      `)
      .in('id', interventionIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[portal-external] Error fetching interventions:', error)
      return NextResponse.json({ 
        error: 'Database error', 
        details: error.message,
        code: error.code,
        hint: error.hint,
        table: 'interventions'
      }, { status: 500 })
    }

    // Fetch document counts for all interventions in one query
    const { data: attachmentCounts, error: attachmentError } = await supabase
      .from('intervention_attachments')
      .select('intervention_id, kind')
      .in('intervention_id', interventionIds)
      .in('kind', ['photos', 'devis', 'facturesArtisans'])

    if (attachmentError) {
      console.error('[portal-external] Error fetching attachments:', attachmentError)
      // Non-blocking: continue without document counts
    }

    // Build a map of document counts per intervention
    const docCountsMap: Record<string, { photos: number; devis: number; facturesArtisans: number }> = {}
    for (const id of interventionIds) {
      docCountsMap[id] = { photos: 0, devis: 0, facturesArtisans: 0 }
    }
    if (attachmentCounts) {
      for (const att of attachmentCounts) {
        const intId = att.intervention_id as string
        const kind = att.kind as string
        if (docCountsMap[intId] && (kind === 'photos' || kind === 'devis' || kind === 'facturesArtisans')) {
          docCountsMap[intId][kind as 'photos' | 'devis' | 'facturesArtisans']++
        }
      }
    }

    // Fetch SST costs for all interventions
    const { data: sstCosts } = await supabase
      .from('intervention_costs')
      .select('intervention_id, amount')
      .in('intervention_id', interventionIds)
      .eq('cost_type', 'sst')

    // Build SST costs map
    const sstCostsMap: Record<string, number> = {}
    if (sstCosts) {
      for (const cost of sstCosts) {
        sstCostsMap[cost.intervention_id as string] = Number(cost.amount)
      }
    }

    // Map to a clean format for the portal
    const mapped = (interventions || []).map((i: Record<string, unknown>) => {
      const owner = i.owner as { id: string; owner_firstname: string | null; owner_lastname: string | null; telephone: string | null } | null
      const tenant = i.tenant as { id: string; firstname: string | null; lastname: string | null; plain_nom_client: string | null; telephone: string | null } | null
      const assignedUser = i.assigned_user as { id: string; firstname: string | null; lastname: string | null; email: string | null } | null
      const metier = i.metiers as { id: string; label: string } | null
      const status = i.intervention_statuses as { id: string; code: string; label: string } | null
      const intId = i.id as string
      const docCounts = docCountsMap[intId] || { photos: 0, devis: 0, facturesArtisans: 0 }

      // Build owner name (Propriétaire/Facturation) from firstname + lastname
      let ownerName: string | null = null
      if (owner) {
        const parts = [owner.owner_firstname, owner.owner_lastname].filter(Boolean)
        ownerName = parts.length > 0 ? parts.join(' ') : null
      }

      // Build tenant name (Locataire/Client) - use plain_nom_client or firstname + lastname
      let tenantName: string | null = null
      if (tenant) {
        if (tenant.plain_nom_client) {
          tenantName = tenant.plain_nom_client
        } else {
          const parts = [tenant.firstname, tenant.lastname].filter(Boolean)
          tenantName = parts.length > 0 ? parts.join(' ') : null
        }
      }

      // Build assigned user fullname
      let assignedUserFullname: string | null = null
      if (assignedUser) {
        const parts = [assignedUser.firstname, assignedUser.lastname].filter(Boolean)
        assignedUserFullname = parts.length > 0 ? parts.join(' ') : null
      }

      return {
        id: i.id,
        id_inter: i.id_inter,
        name: i.contexte_intervention, // Use context as intervention name
        context: i.contexte_intervention,
        consigne: i.consigne_intervention,
        address: i.adresse,
        city: i.ville,
        postal_code: i.code_postal,
        // Legacy field for compatibility
        client_name: tenantName,
        owner_name: ownerName,
        owner_phone: owner?.telephone || null,
        metier: metier?.label || null,
        status: status?.code || null,
        statusCode: status?.code || null,
        statusLabel: status?.label || null,
        date: i.date,
        date_prevue: i.date_prevue,
        dueAt: i.due_date,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        // Document counts
        photos_count: docCounts.photos,
        has_devis: docCounts.devis > 0,
        has_facture_artisan: docCounts.facturesArtisans > 0,
        // SST cost
        cout_sst: sstCostsMap[intId] || null,
        // Enriched data for portal contact tab
        assigned_user_id: i.assigned_user_id,
        assigned_user: assignedUser ? {
          id: assignedUser.id,
          firstname: assignedUser.firstname,
          lastname: assignedUser.lastname,
          email: assignedUser.email,
          fullname: assignedUserFullname
        } : null,
        // Propriétaire (facturation)
        owner: owner ? {
          id: owner.id,
          name: ownerName,
          phone: owner.telephone
        } : null,
        // Locataire (tenant/client)
        tenant: tenant ? {
          id: tenant.id,
          name: tenantName,
          phone: tenant.telephone
        } : null
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
