import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { validatePortalApiRequest } from '@/lib/portal-external/auth'

/**
 * GET /api/portal-external/intervention/[interventionId]/report
 * 
 * Returns the artisan's report for an intervention (if exists).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ interventionId: string }> }
) {
  const authResult = await validatePortalApiRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { interventionId } = await params
  const artisanId = request.nextUrl.searchParams.get('artisanId')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisanId required' }, { status: 400 })
  }

  try {
    const supabase = createServerSupabaseAdmin()

    // Get existing report
    const { data: report, error } = await supabase
      .from('artisan_reports')
      .select(`
        id,
        content,
        status,
        photo_ids,
        submitted_at,
        metadata,
        created_at,
        updated_at
      `)
      .eq('intervention_id', interventionId)
      .eq('artisan_id', artisanId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[portal-external] Error fetching report:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!report) {
      return NextResponse.json({ report: null })
    }

    // Get associated photos
    const { data: photos } = await supabase
      .from('artisan_report_photos')
      .select('*')
      .eq('report_id', report.id)
      .order('created_at', { ascending: true })

    // Generate URLs for photos
    const photosWithUrls = await Promise.all(
      (photos || []).map(async (photo) => {
        const { data } = await supabase.storage
          .from('artisan-report-photos')
          .createSignedUrl(photo.storage_path, 3600)
        
        return {
          id: photo.id,
          filename: photo.filename,
          mimeType: photo.mime_type,
          comment: photo.comment,
          url: data?.signedUrl || null,
          createdAt: photo.created_at
        }
      })
    )

    return NextResponse.json({
      report: {
        ...report,
        photos: photosWithUrls
      }
    })

  } catch (error) {
    console.error('[portal-external] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/portal-external/intervention/[interventionId]/report
 * 
 * Receives a report submitted by an artisan via portal_gmbs.
 * Creates or updates the artisan's report for this intervention.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ interventionId: string }> }
) {
  const authResult = await validatePortalApiRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const { interventionId } = await params

  let body: {
    artisanId: string
    content: string
    photos?: Array<{
      id?: string
      filename: string
      mimeType: string
      comment?: string
      base64Data?: string // For uploading photos
      portalPhotoId?: string
    }>
    portalReportId?: string
    status?: 'draft' | 'submitted'
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { artisanId, content, photos, portalReportId, status = 'submitted' } = body

  if (!artisanId || !content) {
    return NextResponse.json({ error: 'artisanId and content required' }, { status: 400 })
  }

  try {
    const supabase = createServerSupabaseAdmin()

    // Verify intervention belongs to artisan
    const { data: intervention, error: intError } = await supabase
      .from('interventions')
      .select('id, artisan_id')
      .eq('id', interventionId)
      .single()

    if (intError || !intervention) {
      return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })
    }

    if (intervention.artisan_id !== artisanId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Check for existing report
    const { data: existingReport } = await supabase
      .from('artisan_reports')
      .select('id')
      .eq('intervention_id', interventionId)
      .eq('artisan_id', artisanId)
      .single()

    let reportId: string

    if (existingReport) {
      // Update existing report
      const { error: updateError } = await supabase
        .from('artisan_reports')
        .update({
          content,
          status,
          portal_report_id: portalReportId || null,
          synced_from_portal: true,
          submitted_at: status === 'submitted' ? new Date().toISOString() : undefined
        })
        .eq('id', existingReport.id)

      if (updateError) {
        console.error('[portal-external] Update error:', updateError)
        return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
      }

      reportId = existingReport.id
    } else {
      // Create new report
      const { data: newReport, error: insertError } = await supabase
        .from('artisan_reports')
        .insert({
          intervention_id: interventionId,
          artisan_id: artisanId,
          content,
          status,
          portal_report_id: portalReportId || null,
          synced_from_portal: true,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null
        })
        .select('id')
        .single()

      if (insertError || !newReport) {
        console.error('[portal-external] Insert error:', insertError)
        return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
      }

      reportId = newReport.id
    }

    // Handle photos if provided
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        if (photo.base64Data) {
          // Upload photo to storage
          const buffer = Buffer.from(photo.base64Data, 'base64')
          const storagePath = `${interventionId}/${artisanId}/${Date.now()}-${photo.filename}`

          const { error: uploadError } = await supabase.storage
            .from('artisan-report-photos')
            .upload(storagePath, buffer, {
              contentType: photo.mimeType,
              upsert: false
            })

          if (uploadError) {
            console.error('[portal-external] Photo upload error:', uploadError)
            continue // Skip this photo but continue with others
          }

          // Insert photo record
          await supabase
            .from('artisan_report_photos')
            .insert({
              report_id: reportId,
              intervention_id: interventionId,
              artisan_id: artisanId,
              storage_path: storagePath,
              filename: photo.filename,
              mime_type: photo.mimeType,
              size_bytes: buffer.length,
              comment: photo.comment || null,
              portal_photo_id: photo.portalPhotoId || null,
              synced_from_portal: true
            })
        }
      }

      // Update photo_ids array on report
      const { data: allPhotos } = await supabase
        .from('artisan_report_photos')
        .select('id')
        .eq('report_id', reportId)

      if (allPhotos) {
        await supabase
          .from('artisan_reports')
          .update({ photo_ids: allPhotos.map(p => p.id) })
          .eq('id', reportId)
      }
    }

    return NextResponse.json({
      success: true,
      reportId,
      message: existingReport ? 'Report updated' : 'Report created'
    })

  } catch (error) {
    console.error('[portal-external] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
