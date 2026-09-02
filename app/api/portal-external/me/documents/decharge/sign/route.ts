import { NextResponse } from 'next/server'
import { artisanDisplayName, authenticatePortalRequest, portalError } from '@/lib/portal-external/auth'
import { portalInternalError, readJsonBody } from '@/lib/portal-external/http'
import { decodeBase64Payload, sha256Hex, uploadToDocumentsBucket } from '@/lib/portal-external/uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Texte auquel l'artisan consent (conservé dans les métadonnées de la pièce). */
const DECHARGE_CONSENT_TEXT =
  "Je certifie être l'artisan désigné et j'accepte les conditions de la décharge de partenariat GMBS. " +
  'Ma signature électronique tracée ci-dessus a la même valeur que ma signature manuscrite.'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

/**
 * POST /api/portal-external/me/documents/decharge/sign
 * `{ signer_name, consent: true, signature_png_base64 }` → `201 { document, signed_at }`.
 * « Signature simple » : le PNG du tracé est déposé comme pièce
 * `decharge_partenariat` avec les preuves (signataire, IP, user-agent, sha256).
 */
export async function POST(request: Request) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const { body } = parsed

  const signerName = typeof body.signer_name === 'string' ? body.signer_name.trim().slice(0, 120) : ''
  if (body.consent !== true) return portalError(400, 'consent must be true')
  if (!signerName) return portalError(400, 'signer_name required')

  const decoded = decodeBase64Payload(body.signature_png_base64)
  if (!decoded.ok) return portalError(decoded.status, decoded.error === 'base64Data required' ? 'signature_png_base64 required' : decoded.error)
  if (decoded.buffer.length < 8 || !decoded.buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return portalError(415, 'signature_png_base64 must be a PNG')
  }

  try {
    const signedAt = new Date().toISOString()
    const timestamp = Date.now()
    const path = `artisans/${auth.artisan.id}/decharge_partenariat/${timestamp}-signature.png`
    const upload = await uploadToDocumentsBucket(auth.supabase, path, decoded.buffer, 'image/png')
    if (!upload.ok) return portalError(500, upload.error)

    const metadata = {
      source: 'portal',
      signed_at: signedAt,
      signer_name: signerName,
      ip: clientIp(request),
      user_agent: request.headers.get('user-agent'),
      consent_text: DECHARGE_CONSENT_TEXT,
      sha256: sha256Hex(decoded.buffer),
    }

    const { data, error } = await auth.supabase
      .from('artisan_attachments')
      .insert({
        artisan_id: auth.artisan.id,
        kind: 'decharge_partenariat',
        url: upload.url,
        filename: `decharge-partenariat-signee-${timestamp}.png`,
        mime_type: 'image/png',
        file_size: decoded.buffer.length,
        created_by: null,
        created_by_display: `${artisanDisplayName(auth.artisan)} (artisan)`,
        review_status: 'pending',
        metadata,
      })
      .select('id, url')
      .single()

    if (error || !data) {
      console.error('[portal-external] Enregistrement de la décharge échoué :', error?.message)
      return portalError(500, 'Failed to save signed document')
    }

    return NextResponse.json({ document: data, signed_at: signedAt }, { status: 201 })
  } catch (error) {
    return portalInternalError('me/documents/decharge/sign', error)
  }
}
