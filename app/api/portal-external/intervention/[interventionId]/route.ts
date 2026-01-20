import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { validatePortalApiRequest } from '@/lib/portal-external/auth'

/**
 * GET /api/portal-external/intervention/[interventionId]?artisanId={artisanId}
 * 
 * Returns detailed intervention data with documents grouped by kind.
 * Called by portal_gmbs to display intervention detail page.
 * 
 * Auth: X-GMBS-Key-Id + X-GMBS-Secret headers
 * 
 * Security: Verifies the artisan is assigned to this intervention.
 * 
 * Documents exposed (grouped by kind):
 * - photos: images (for gallery display)
 * - devis: quotes
 * - facturesArtisans: artisan invoices
 * 
 * NOT exposed (internal documents):
 * - facturesGMBS, facturesMateriel, a_classe
 */

interface PhotoDocument {
  id: string
  url: string
  filename: string | null
  mime_type: string | null
  created_at: string
  created_by_display: string | null
}

interface FileDocument {
  id: string
  url: string
  filename: string | null
  mime_type: string | null
  file_size: number | null
  created_at: string
}

interface InterventionDocuments {
  photos: PhotoDocument[]
  devis: FileDocument[]
  facturesArtisans: FileDocument[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ interventionId: string }> }
) {
  // Validate portal API credentials
  const authResult = await validatePortalApiRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { interventionId } = await params

  // Get artisanId from query params (required for authorization)
  const artisanId = request.nextUrl.searchParams.get('artisanId')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisanId query parameter is required' }, { status: 400 })
  }

  try {
    const supabase = createServerSupabaseAdmin()

    // Verify the artisan is assigned to this intervention
    const { data: assignment, error: assignError } = await supabase
      .from('intervention_artisans')
      .select('id')
      .eq('intervention_id', interventionId)
      .eq('artisan_id', artisanId)
      .single()

    if (assignError || !assignment) {
      return NextResponse.json({ error: 'Not authorized - artisan not assigned to this intervention' }, { status: 403 })
    }

    // Fetch intervention with related data
    const { data: intervention, error: intError } = await supabase
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
        account_id,
        assigned_user_id,
        agencies:agence_id (
          id,
          label
        ),
        owner:owner_id (
          id,
          owner_firstname,
          owner_lastname,
          telephone
        ),
        accounts:account_id (
          id,
          nom_compte,
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
      .eq('id', interventionId)
      .single()

    if (intError) {
      console.error('[portal-external] Error fetching intervention:', intError)
      if (intError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })
      }
      return NextResponse.json({ 
        error: 'Database error', 
        details: intError.message,
        code: intError.code
      }, { status: 500 })
    }

    if (!intervention) {
      return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })
    }

    // Fetch documents - only allowed kinds for artisan viewing
    const allowedKinds = ['photos', 'devis', 'facturesArtisans']
    
    const { data: attachments, error: attachError } = await supabase
      .from('intervention_attachments')
      .select('id, kind, url, filename, mime_type, file_size, created_at, created_by_display')
      .eq('intervention_id', interventionId)
      .in('kind', allowedKinds)
      .order('created_at', { ascending: false })

    if (attachError) {
      console.error('[portal-external] Error fetching attachments:', attachError)
      // Non-blocking: continue without documents
    }

    // Group documents by kind
    const documents: InterventionDocuments = {
      photos: [],
      devis: [],
      facturesArtisans: []
    }

    if (attachments) {
      for (const att of attachments) {
        const baseDoc = {
          id: att.id,
          url: att.url,
          filename: att.filename,
          mime_type: att.mime_type,
          created_at: att.created_at
        }

        switch (att.kind) {
          case 'photos':
            documents.photos.push({
              ...baseDoc,
              created_by_display: att.created_by_display
            })
            break
          case 'devis':
            documents.devis.push({
              ...baseDoc,
              file_size: att.file_size
            })
            break
          case 'facturesArtisans':
            documents.facturesArtisans.push({
              ...baseDoc,
              file_size: att.file_size
            })
            break
        }
      }
    }

    // Fetch SST cost for this intervention
    const { data: sstCost } = await supabase
      .from('intervention_costs')
      .select('amount')
      .eq('intervention_id', interventionId)
      .eq('cost_type', 'sst')
      .single()

    // Extract related data (Supabase returns arrays for joins, take first element)
    const agencyArr = intervention.agencies as { id: string; label: string }[] | null
    const agency = agencyArr?.[0] || null
    const ownerArr = intervention.owner as { id: string; owner_firstname: string | null; owner_lastname: string | null; telephone: string | null }[] | null
    const owner = ownerArr?.[0] || null
    const accountArr = intervention.accounts as { id: string; nom_compte: string | null; telephone: string | null }[] | null
    const account = accountArr?.[0] || null
    const assignedUserArr = intervention.assigned_user as { id: string; firstname: string | null; lastname: string | null; email: string | null }[] | null
    const assignedUser = assignedUserArr?.[0] || null
    const metierArr = intervention.metiers as { id: string; label: string }[] | null
    const metier = metierArr?.[0] || null
    const statusArr = intervention.intervention_statuses as { id: string; code: string; label: string }[] | null
    const status = statusArr?.[0] || null

    // Build owner name from firstname + lastname
    let ownerName: string | null = null
    if (owner) {
      const parts = [owner.owner_firstname, owner.owner_lastname].filter(Boolean)
      ownerName = parts.length > 0 ? parts.join(' ') : null
    }

    // Build assigned user fullname
    let assignedUserFullname: string | null = null
    if (assignedUser) {
      const parts = [assignedUser.firstname, assignedUser.lastname].filter(Boolean)
      assignedUserFullname = parts.length > 0 ? parts.join(' ') : null
    }

    // Build response
    const response = {
      intervention: {
        id: intervention.id,
        id_inter: intervention.id_inter,
        name: intervention.contexte_intervention,
        context: intervention.contexte_intervention,
        consigne: intervention.consigne_intervention,
        address: intervention.adresse,
        city: intervention.ville,
        postal_code: intervention.code_postal,
        client_name: agency?.label || null,
        owner_name: ownerName,
        owner_phone: owner?.telephone || null,
        metier: metier?.label || null,
        status: status?.code || null,
        statusCode: status?.code || null,
        statusLabel: status?.label || null,
        date: intervention.date,
        date_prevue: intervention.date_prevue,
        dueAt: intervention.due_date,
        createdAt: intervention.created_at,
        updatedAt: intervention.updated_at,
        // Document counts
        photos_count: documents.photos.length,
        has_devis: documents.devis.length > 0,
        has_facture_artisan: documents.facturesArtisans.length > 0,
        // SST cost
        cout_sst: sstCost?.amount ? Number(sstCost.amount) : null,
        // New enriched data for portal
        assigned_user_id: intervention.assigned_user_id,
        assigned_user: assignedUser ? {
          id: assignedUser.id,
          firstname: assignedUser.firstname,
          lastname: assignedUser.lastname,
          email: assignedUser.email,
          fullname: assignedUserFullname
        } : null,
        client: account ? {
          id: account.id,
          name: account.nom_compte,
          phone: account.telephone
        } : null,
        owner: owner ? {
          id: owner.id,
          name: ownerName,
          phone: owner.telephone
        } : null
      },
      documents
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[portal-external] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
