import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { validatePortalApiRequest } from '@/lib/portal-external/auth'

const STORAGE_BUCKET = 'artisan-documents'

// Document types artisans can view/upload via portal
const ALLOWED_KINDS = ['kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat', 'autre']

/**
 * GET /api/portal-external/artisan/[artisanId]/documents
 * 
 * Returns legal documents for an artisan.
 * Auth: X-GMBS-Key-Id + X-GMBS-Secret headers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artisanId: string }> }
) {
  const authResult = await validatePortalApiRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { artisanId } = await params

  try {
    const supabase = createServerSupabaseAdmin()

    // Verify artisan exists
    const { data: artisan, error: artisanError } = await supabase
      .from('artisans')
      .select('id, nom, prenom, email, telephone, raison_sociale')
      .eq('id', artisanId)
      .single()

    if (artisanError || !artisan) {
      return NextResponse.json({ error: 'Artisan not found' }, { status: 404 })
    }

    // Get documents
    const { data: documents, error } = await supabase
      .from('artisan_attachments')
      .select('*')
      .eq('artisan_id', artisanId)
      .in('kind', ALLOWED_KINDS)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[portal-external] Error fetching documents:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Generate URLs
    const documentsWithUrls = (documents || []).map(doc => {
      // The url field might already be a full URL or a storage path
      let url = doc.url
      
      // If it's a storage path, generate signed URL
      if (doc.url && !doc.url.startsWith('http')) {
        const { data } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(doc.url)
        url = data?.publicUrl || doc.url
      }

      return {
        id: doc.id,
        kind: doc.kind,
        kindLabel: mapKindToLabel(doc.kind),
        filename: doc.filename,
        mimeType: doc.mime_type,
        url,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at
      }
    })

    // Group by kind for easier display
    const grouped: Record<string, typeof documentsWithUrls[0] | null> = {}
    for (const kind of ALLOWED_KINDS) {
      grouped[kind] = documentsWithUrls.find(d => d.kind === kind) || null
    }

    return NextResponse.json({
      artisan: {
        id: artisan.id,
        name: [artisan.prenom, artisan.nom].filter(Boolean).join(' '),
        email: artisan.email,
        phone: artisan.telephone,
        company: artisan.raison_sociale
      },
      documents: documentsWithUrls,
      documentsByKind: grouped,
      requiredDocuments: ['kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat']
    })

  } catch (error) {
    console.error('[portal-external] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/portal-external/artisan/[artisanId]/documents
 * 
 * Upload or update a document for an artisan.
 * Receives base64 encoded file.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ artisanId: string }> }
) {
  const authResult = await validatePortalApiRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { artisanId } = await params

  let body: {
    kind: string
    filename: string
    mimeType: string
    base64Data: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { kind, filename, mimeType, base64Data } = body

  if (!kind || !filename || !mimeType || !base64Data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!ALLOWED_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Invalid document kind' }, { status: 400 })
  }

  try {
    const supabase = createServerSupabaseAdmin()

    // Verify artisan exists
    const { data: artisan } = await supabase
      .from('artisans')
      .select('id')
      .eq('id', artisanId)
      .single()

    if (!artisan) {
      return NextResponse.json({ error: 'Artisan not found' }, { status: 404 })
    }

    // Upload to storage
    const buffer = Buffer.from(base64Data, 'base64')
    const storagePath = `${artisanId}/${kind}/${Date.now()}-${filename}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false
      })

    if (uploadError) {
      console.error('[portal-external] Upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    // Check if document of this kind already exists
    const { data: existingDoc } = await supabase
      .from('artisan_attachments')
      .select('id')
      .eq('artisan_id', artisanId)
      .eq('kind', kind)
      .single()

    let documentId: string

    if (existingDoc) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from('artisan_attachments')
        .update({
          url: urlData.publicUrl,
          filename,
          mime_type: mimeType,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDoc.id)
        .select('id')
        .single()

      if (updateError) {
        console.error('[portal-external] Update error:', updateError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }

      documentId = updated.id
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from('artisan_attachments')
        .insert({
          artisan_id: artisanId,
          kind,
          url: urlData.publicUrl,
          filename,
          mime_type: mimeType
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('[portal-external] Insert error:', insertError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }

      documentId = inserted.id
    }

    return NextResponse.json({
      success: true,
      documentId,
      url: urlData.publicUrl,
      message: existingDoc ? 'Document updated' : 'Document uploaded'
    })

  } catch (error) {
    console.error('[portal-external] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function mapKindToLabel(kind: string): string {
  const map: Record<string, string> = {
    'kbis': 'Kbis / Extrait RCS',
    'assurance': 'Attestation assurance décennale',
    'cni_recto_verso': 'Pièce d\'identité',
    'iban': 'RIB / IBAN',
    'decharge_partenariat': 'Décharge de partenariat',
    'photo_profil': 'Photo de profil',
    'portfolio': 'Portfolio',
    'autre': 'Autre document',
    'a_classe': 'À classer'
  }
  return map[kind] || kind
}
