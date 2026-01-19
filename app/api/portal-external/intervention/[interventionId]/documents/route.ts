import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { validatePortalApiRequest } from '@/lib/portal-external/auth'

/**
 * GET /api/portal-external/intervention/[interventionId]/documents
 * 
 * Returns documents (devis, facturesArtisans, photos) for an intervention.
 * These are documents added by gestionnaires, shown read-only to artisans.
 * 
 * Auth: X-GMBS-Key-Id + X-GMBS-Secret headers
 */
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

  // Get artisanId from query params (portal passes it for validation)
  const artisanId = request.nextUrl.searchParams.get('artisanId')

  try {
    const supabase = createServerSupabaseAdmin()

    // First verify the artisan is assigned to this intervention
    if (artisanId) {
      const { data: assignment, error: assignError } = await supabase
        .from('intervention_artisans')
        .select('id')
        .eq('intervention_id', interventionId)
        .eq('artisan_id', artisanId)
        .single()

      if (assignError || !assignment) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
    }

    // Get documents - only specific types for artisan viewing
    // Types: devis, facturesArtisans, photos (gestionnaire documents)
    const allowedKinds = ['devis', 'facturesArtisans', 'photos']
    
    const { data: documents, error } = await supabase
      .from('intervention_attachments')
      .select('*')
      .eq('intervention_id', interventionId)
      .in('kind', allowedKinds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[portal-external] Error fetching documents:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Map documents - url field already contains the full URL
    const documentsWithUrls = (documents || []).map((doc) => {
      return {
        id: doc.id,
        kind: doc.kind,
        kindLabel: mapKindToLabel(doc.kind),
        filename: doc.filename,
        mimeType: doc.mime_type,
        url: doc.url, // URL is stored directly in the database
        sizeBytes: doc.file_size,
        createdAt: doc.created_at,
        metadata: doc.metadata || {}
      }
    })

    return NextResponse.json({
      documents: documentsWithUrls,
      count: documentsWithUrls.length
    })

  } catch (error) {
    console.error('[portal-external] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function mapKindToLabel(kind: string): string {
  const map: Record<string, string> = {
    'devis': 'Devis',
    'photos': 'Photos',
    'facturesArtisans': 'Facture artisan',
    'facturesGMBS': 'Facture GMBS',
    'facturesMateriel': 'Facture matériel',
    'autre': 'Autre',
    'a_classe': 'À classer'
  }
  return map[kind] || kind
}
