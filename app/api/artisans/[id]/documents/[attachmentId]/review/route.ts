import { NextResponse } from 'next/server'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { parseReviewBody, mergeValidUntil } from '@/lib/artisans/document-review'
import { recordArtisanDocumentAction } from '@/lib/artisans/artisan-action-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; attachmentId: string }> }

/**
 * Identifiants attendus : des UUID. Un identifiant mal formé partirait sinon
 * jusqu'à Postgres, qui répond `22P02` — et la route rendrait un `500` là où
 * la bonne réponse est le `404` uniforme du contrat.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Colonnes renvoyées au CRM après la décision. */
const DOCUMENT_SELECT =
  'id, artisan_id, kind, filename, url, mime_type, file_size, created_at, review_status, reviewed_at, review_comment, metadata'

/**
 * POST /api/artisans/{id}/documents/{attachmentId}/review  (permission `write_artisans`)
 *
 * `{ decision:'approved'|'rejected', comment?, valid_until? }` →
 * `200 { document, artisan:{ statut_dossier, pieces_a_verifier, dossier_validated_at } }`.
 *
 * **Pourquoi une route Next et pas l'Edge Function `documents`** : son `PUT`
 * n'accepte que `kind / filename / mime_type / file_size / created_by*` — il est
 * impossible d'y écrire `review_status`. Et la garde ne peut pas venir de la
 * base : `99057` donne à `authenticated` un `UPDATE USING(true)` complet sur
 * `artisan_attachments`. La permission est donc vérifiée ici, et l'écriture
 * passe par `createServerSupabaseAdmin`.
 *
 * **Motif obligatoire au refus** (`400` sinon) : sans lui l'artisan redépose la
 * même pièce et le gestionnaire refait le travail.
 *
 * `statut_dossier`, `pieces_a_verifier` et `dossier_validated_at` ne sont
 * **jamais** écrits ici : `trg_artisan_dossier_sync` (99078) est leur seul
 * écrivain. On les relit après coup pour que l'UI n'ait pas à deviner.
 */
export async function POST(request: Request, { params }: Params) {
  const permCheck = await requirePermission(request, 'write_artisans')
  if (isPermissionError(permCheck)) return permCheck.error
  const reviewer = permCheck.user

  const { id, attachmentId } = await params
  if (!id || !attachmentId) {
    return NextResponse.json({ error: 'Artisan ID et document ID sont requis' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseReviewBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(attachmentId)) {
    return NextResponse.json({ error: 'Pièce introuvable' }, { status: 404 })
  }

  try {
    const supabase = createServerSupabaseAdmin()

    // La pièce doit appartenir à l'artisan de l'URL : un id de pièce étranger
    // est un 404 uniforme, jamais une réponse qui révèle son existence.
    const { data: existing, error: readError } = await supabase
      .from('artisan_attachments')
      .select('id, artisan_id, kind, filename, metadata')
      .eq('id', attachmentId)
      .eq('artisan_id', id)
      .maybeSingle()

    if (readError) {
      console.error('[artisans/documents/review] Lecture de la pièce échouée :', readError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (!existing) return NextResponse.json({ error: 'Pièce introuvable' }, { status: 404 })

    const current = existing as {
      id: string
      artisan_id: string
      kind: string
      filename: string | null
      metadata: Record<string, unknown> | null
    }

    const reviewedAt = new Date().toISOString()
    const { data: document, error: updateError } = await supabase
      .from('artisan_attachments')
      .update({
        review_status: parsed.decision,
        reviewed_by: reviewer.id,
        reviewed_at: reviewedAt,
        review_comment: parsed.comment,
        metadata: mergeValidUntil(current.metadata, parsed.validUntil),
      })
      .eq('id', attachmentId)
      .eq('artisan_id', id)
      .select(DOCUMENT_SELECT)
      .single()

    if (updateError || !document) {
      console.error('[artisans/documents/review] Mise à jour échouée :', updateError?.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Relecture APRÈS l'update : le trigger a recalculé statut_dossier,
    // pieces_a_verifier et posé (ou effacé) dossier_validated_at.
    const { data: artisanRow } = await supabase
      .from('artisans')
      .select('id, statut_dossier, pieces_a_verifier, dossier_validated_at')
      .eq('id', id)
      .maybeSingle()

    const { data: reviewerRow } = await supabase
      .from('users')
      .select('firstname, lastname, username')
      .eq('id', reviewer.id)
      .maybeSingle()
    const reviewerName =
      [reviewerRow?.firstname, reviewerRow?.lastname].filter(Boolean).join(' ').trim() ||
      reviewerRow?.username ||
      'un gestionnaire'

    await recordArtisanDocumentAction(supabase, {
      artisanId: id,
      actionType: parsed.decision === 'approved' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
      source: 'crm',
      actorUserId: reviewer.id,
      actorLabel: reviewerName,
      attachmentId,
      payload: {
        kind: current.kind,
        filename: current.filename,
        comment: parsed.comment,
        valid_until: parsed.validUntil,
      },
    })

    return NextResponse.json({
      document,
      artisan: {
        statut_dossier: artisanRow?.statut_dossier ?? null,
        pieces_a_verifier: artisanRow?.pieces_a_verifier ?? 0,
        dossier_validated_at: artisanRow?.dossier_validated_at ?? null,
      },
    })
  } catch (error) {
    console.error('[artisans/documents/review] Erreur inattendue :', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
