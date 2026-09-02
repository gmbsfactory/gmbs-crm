import { NextResponse } from 'next/server'
import { artisanDisplayName, authenticatePortalRequest, portalError } from '@/lib/portal-external/auth'
import { portalInternalError, readJsonBody } from '@/lib/portal-external/http'
import { getPortalIntervention } from '@/lib/portal-external/interventions'
import {
  PHOTO_MIME_TYPES,
  decodeBase64Payload,
  matchesDeclaredMime,
  sanitizeFilename,
  uploadToDocumentsBucket,
} from '@/lib/portal-external/uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const PHASES = ['avant', 'apres'] as const

/**
 * POST /api/portal-external/me/interventions/{id}/photos
 * `{ filename, mimeType, base64Data, phase, comment? }` → `201 { attachment }`.
 * Stockage : bucket « documents », `intervention/{id}/photos/portal-{timestamp}-{filename}` ;
 * ligne `intervention_attachments (kind='photos', metadata.source='portal')`.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const { body } = parsed

  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : ''
  const phase = typeof body.phase === 'string' ? body.phase : ''
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 500) : null

  if (!mimeType) return portalError(400, 'mimeType required')
  if (!(PHASES as readonly string[]).includes(phase)) return portalError(400, "phase must be 'avant' or 'apres'")
  if (!(PHOTO_MIME_TYPES as readonly string[]).includes(mimeType)) return portalError(415, 'Unsupported media type')

  const decoded = decodeBase64Payload(body.base64Data)
  if (!decoded.ok) return portalError(decoded.status, decoded.error)
  if (!matchesDeclaredMime(decoded.buffer, mimeType)) return portalError(415, 'File content does not match mimeType')

  try {
    const target = await getPortalIntervention(auth.supabase, auth.artisan.id, id)
    if (!target) return portalError(404, 'Intervention not found')

    const filename = sanitizeFilename(body.filename, `photo-${phase}.${mimeType.split('/')[1] ?? 'jpg'}`)
    const path = `intervention/${id}/photos/portal-${Date.now()}-${filename}`
    const upload = await uploadToDocumentsBucket(auth.supabase, path, decoded.buffer, mimeType)
    if (!upload.ok) return portalError(500, upload.error)

    const metadata = { source: 'portal', phase, comment, artisan_id: auth.artisan.id }
    const { data, error } = await auth.supabase
      .from('intervention_attachments')
      .insert({
        intervention_id: id,
        kind: 'photos',
        url: upload.url,
        filename,
        mime_type: mimeType,
        file_size: decoded.buffer.length,
        created_by: null,
        created_by_display: `${artisanDisplayName(auth.artisan)} (artisan)`,
        metadata,
      })
      .select('id, url, filename, metadata')
      .single()

    if (error || !data) {
      console.error('[portal-external] Insertion de la photo échouée :', error?.message)
      return portalError(500, 'Failed to save photo')
    }

    return NextResponse.json({ attachment: data }, { status: 201 })
  } catch (error) {
    return portalInternalError('me/interventions/[id]/photos', error)
  }
}
