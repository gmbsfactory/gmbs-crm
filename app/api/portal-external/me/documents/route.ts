import { NextResponse } from 'next/server'
import { artisanDisplayName, authenticatePortalRequest, portalError } from '@/lib/portal-external/auth'
import { portalInternalError, readJsonBody } from '@/lib/portal-external/http'
import {
  decodeBase64Payload,
  isDocumentMimeAllowed,
  matchesDeclaredMime,
  sanitizeFilename,
  uploadToDocumentsBucket,
} from '@/lib/portal-external/uploads'
import { REQUIRED_DOCUMENT_KINDS } from '@/lib/artisans/dossierStatus'
import { recordArtisanDocumentAction } from '@/lib/artisans/artisan-action-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pièces visibles / déposables depuis le portail : les 5 requises + « autre ». */
const PORTAL_DOCUMENT_KINDS: string[] = [...REQUIRED_DOCUMENT_KINDS, 'autre']

const DOCUMENT_SELECT = 'id, kind, filename, url, mime_type, file_size, created_at, review_status, metadata'

interface PortalDocumentRow {
  id: string
  kind: string
  filename: string | null
  url: string
  mime_type: string | null
  file_size: number | null
  created_at: string | null
  review_status: string | null
  metadata: Record<string, unknown> | null
}

/**
 * GET /api/portal-external/me/documents
 * Pièces du dossier de l'artisan (la plus récente par type dans `documentsByKind`).
 */
export async function GET(request: Request) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response

  try {
    const { data, error } = await auth.supabase
      .from('artisan_attachments')
      .select(DOCUMENT_SELECT)
      .eq('artisan_id', auth.artisan.id)
      .in('kind', PORTAL_DOCUMENT_KINDS)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[portal-external] Lecture des pièces échouée :', error.message)
      return portalError(500, 'Database error')
    }

    const documents = ((data ?? []) as PortalDocumentRow[]).map((d) => ({ ...d, metadata: d.metadata ?? {} }))
    const documentsByKind: Record<string, PortalDocumentRow | null> = {}
    for (const kind of PORTAL_DOCUMENT_KINDS) {
      documentsByKind[kind] = documents.find((d) => d.kind === kind) ?? null
    }

    return NextResponse.json({ requiredDocuments: REQUIRED_DOCUMENT_KINDS, documents, documentsByKind })
  } catch (error) {
    return portalInternalError('me/documents GET', error)
  }
}

/**
 * POST /api/portal-external/me/documents
 * `{ kind, filename, mimeType, base64Data }` → `201 { document: { id, kind, url } }`.
 * Nouvelle ligne `artisan_attachments` à chaque dépôt (jamais d'écrasement),
 * `review_status = 'pending'`, `metadata.source = 'portal'`.
 */
export async function POST(request: Request) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const { body } = parsed

  const kind = typeof body.kind === 'string' ? body.kind.trim() : ''
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : ''

  if (!PORTAL_DOCUMENT_KINDS.includes(kind)) return portalError(400, 'Invalid document kind')
  if (!mimeType) return portalError(400, 'mimeType required')
  if (!isDocumentMimeAllowed(mimeType)) return portalError(415, 'Unsupported media type')

  const decoded = decodeBase64Payload(body.base64Data)
  if (!decoded.ok) return portalError(decoded.status, decoded.error)
  // Les octets magiques doivent correspondre au type déclaré (le MIME est réutilisé tel quel par Storage).
  if (!matchesDeclaredMime(decoded.buffer, mimeType)) return portalError(415, 'File content does not match mimeType')

  try {
    const filename = sanitizeFilename(body.filename, `${kind}.${mimeType === 'application/pdf' ? 'pdf' : 'bin'}`)
    const path = `artisans/${auth.artisan.id}/${kind}/${Date.now()}-${filename}`
    const upload = await uploadToDocumentsBucket(auth.supabase, path, decoded.buffer, mimeType)
    if (!upload.ok) return portalError(500, upload.error)

    const { data, error } = await auth.supabase
      .from('artisan_attachments')
      .insert({
        artisan_id: auth.artisan.id,
        kind,
        url: upload.url,
        filename,
        mime_type: mimeType,
        file_size: decoded.buffer.length,
        created_by: null,
        created_by_display: `${artisanDisplayName(auth.artisan)} (artisan)`,
        review_status: 'pending',
        metadata: { source: 'portal' },
      })
      .select('id, kind, url')
      .single()

    if (error || !data) {
      console.error('[portal-external] Insertion de la pièce échouée :', error?.message)
      return portalError(500, 'Failed to save document')
    }

    // Journal des actions (§4.3, lot L6) : « pièce déposée » doit apparaître
    // dans la frise du modal artisan au même titre que « prix accepté ». Écrit
    // APRÈS l'insertion et sans jamais faire échouer le dépôt : la pièce est
    // déjà en base, sa trace ne peut pas la reprendre.
    await recordArtisanDocumentAction(auth.supabase, {
      artisanId: auth.artisan.id,
      actionType: 'DOCUMENT_UPLOADED',
      source: 'portal',
      actorLabel: `${artisanDisplayName(auth.artisan)} (artisan)`,
      attachmentId: (data as { id: string }).id,
      eventUid: typeof body.event_uid === 'string' && body.event_uid.trim() ? body.event_uid.trim() : null,
      payload: { kind, filename, mime_type: mimeType, file_size: decoded.buffer.length },
    })

    return NextResponse.json({ document: data }, { status: 201 })
  } catch (error) {
    return portalInternalError('me/documents POST', error)
  }
}
