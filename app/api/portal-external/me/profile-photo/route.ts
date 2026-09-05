import { NextResponse } from 'next/server'
import { artisanDisplayName, authenticatePortalRequest, portalError } from '@/lib/portal-external/auth'
import { portalInternalError, readJsonBody } from '@/lib/portal-external/http'
import {
  decodeBase64Payload,
  matchesDeclaredMime,
  sanitizeFilename,
  uploadToDocumentsBucket,
} from '@/lib/portal-external/uploads'
import { recordArtisanDocumentAction } from '@/lib/artisans/artisan-action-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Types acceptés pour une photo de profil : images seulement, liste fermée.
 * Le HEIC de l'iPhone est ré-encodé en JPEG **sur le téléphone** par
 * `compressImage` avant l'envoi : il n'arrive jamais jusqu'ici.
 */
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Tailles produites par `process-avatar` (`fit:'cover', position:'center'`). */
const AVATAR_SIZES = [40, 80, 160] as const

interface AvatarRow {
  id: string
  url: string
  content_hash: string | null
  derived_sizes: Record<string, string> | null
  mime_preferred: string | null
}

const AVATAR_SELECT = 'id, url, content_hash, derived_sizes, mime_preferred'

function avatarPayload(row: AvatarRow | null) {
  if (!row) return null
  return {
    url: row.url,
    sizes: row.derived_sizes ?? {},
    hash: row.content_hash,
    mime_preferred: row.mime_preferred ?? 'image/jpeg',
  }
}

/**
 * POST /api/portal-external/me/profile-photo
 *
 * `{ event_uid, filename, mime_type, content_base64 }` → `201 { avatar:{ url, sizes:{40,80,160} } }`
 * `{ event_uid, mode:'initials' }` → `200 { avatar: null }` (repli initiales du CRM).
 *
 * Trois points que la spécification (§2.2) demande explicitement :
 *
 * 1. **Pas de `review_status = 'pending'`.** L'avatar n'entre pas dans le
 *    compteur « pièces à vérifier » : sinon chaque changement de photo créerait
 *    une tâche fantôme pour le gestionnaire. La colonne garde son DEFAULT
 *    `'approved'`, et `photo_profil` n'est pas une pièce requise du dossier —
 *    `statut_dossier` n'en dépend donc pas.
 * 2. **L'ancienne `photo_profil` est supprimée avant l'insertion** : une seule
 *    ligne par artisan, comme le fait déjà l'Edge Function `documents`.
 * 3. **`process-avatar` est attendu** (`await`), pas lancé en arrière-plan :
 *    c'est lui qui remplit `derived_sizes`, et la réponse doit les porter. Son
 *    échec n'est pas fatal : `Avatar.tsx` retombe sur l'URL de base, l'avatar
 *    s'affiche quand même dans le CRM.
 */
export async function POST(request: Request) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const { body } = parsed

  const mode = typeof body.mode === 'string' ? body.mode.trim() : ''
  const eventUid =
    typeof body.event_uid === 'string' && body.event_uid.trim() ? body.event_uid.trim() : null

  try {
    // P5 : le téléphone travaille hors ligne et rejoue. Un `event_uid` déjà
    // journalisé renvoie l'avatar DÉJÀ enregistré, sans redéposer le fichier ni
    // supprimer la photo en place : un rejeu ne doit jamais coûter un aller-retour
    // Storage, encore moins effacer ce qu'il vient de poser. Le lookup est
    // `(artisan_id, event_uid)`, jamais `event_uid` seul (index de 99079).
    if (eventUid) {
      const { data: dejaVu } = await auth.supabase
        .from('artisan_portal_actions')
        .select('id')
        .eq('artisan_id', auth.artisan.id)
        .eq('event_uid', eventUid)
        .maybeSingle()

      if (dejaVu) {
        const { data: courant } = await auth.supabase
          .from('artisan_attachments')
          .select(AVATAR_SELECT)
          .eq('artisan_id', auth.artisan.id)
          .eq('kind', 'photo_profil')
          .maybeSingle()
        return NextResponse.json({ avatar: avatarPayload((courant as AvatarRow | null) ?? null) })
      }
    }

    // --- Repli « mes initiales » : on retire la photo, rien d'autre ---------
    if (mode === 'initials') {
      const { error } = await auth.supabase
        .from('artisan_attachments')
        .delete()
        .eq('artisan_id', auth.artisan.id)
        .eq('kind', 'photo_profil')
      if (error) {
        console.error('[portal-external] Suppression de la photo de profil échouée :', error.message)
        return portalError(500, 'Failed to remove profile photo')
      }
      await recordArtisanDocumentAction(auth.supabase, {
        artisanId: auth.artisan.id,
        actionType: 'AVATAR_CHANGED',
        source: 'portal',
        actorLabel: `${artisanDisplayName(auth.artisan)} (artisan)`,
        eventUid,
        payload: { mode: 'initials' },
      })
      return NextResponse.json({ avatar: null })
    }

    // --- Photo envoyée depuis l'application ---------------------------------
    const mimeType = typeof body.mime_type === 'string' ? body.mime_type.trim().toLowerCase() : ''
    if (!mimeType) return portalError(400, 'mime_type required')
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return portalError(415, 'Unsupported media type')
    }

    const decoded = decodeBase64Payload(body.content_base64 ?? body.base64Data)
    if (!decoded.ok) return portalError(decoded.status, decoded.error)
    // Les octets magiques doivent correspondre au type déclaré : le MIME est
    // réutilisé tel quel par Storage, sur un bucket public.
    if (!matchesDeclaredMime(decoded.buffer, mimeType)) {
      return portalError(415, 'File content does not match mime_type')
    }

    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
    const filename = sanitizeFilename(body.filename, `photo_profil.${extension}`)
    const path = `artisans/${auth.artisan.id}/photo_profil/${Date.now()}-${filename}`
    const upload = await uploadToDocumentsBucket(auth.supabase, path, decoded.buffer, mimeType)
    if (!upload.ok) return portalError(500, upload.error)

    // Une seule photo de profil par artisan : l'ancienne ligne part d'abord.
    const { error: deleteError } = await auth.supabase
      .from('artisan_attachments')
      .delete()
      .eq('artisan_id', auth.artisan.id)
      .eq('kind', 'photo_profil')
    if (deleteError) {
      console.warn('[portal-external] Ancienne photo de profil non supprimée :', deleteError.message)
    }

    const { data: inserted, error: insertError } = await auth.supabase
      .from('artisan_attachments')
      .insert({
        artisan_id: auth.artisan.id,
        kind: 'photo_profil',
        url: upload.url,
        filename,
        mime_type: mimeType,
        file_size: decoded.buffer.length,
        created_by: null,
        created_by_display: `${artisanDisplayName(auth.artisan)} (artisan)`,
        // PAS de review_status : le DEFAULT 'approved' garde l'avatar hors du
        // compteur « pièces à vérifier ».
        metadata: { source: 'portal' },
      })
      .select(AVATAR_SELECT)
      .single()

    if (insertError || !inserted) {
      console.error('[portal-external] Insertion de la photo de profil échouée :', insertError?.message)
      return portalError(500, 'Failed to save profile photo')
    }

    const row = inserted as AvatarRow

    // Dérivées 40 / 80 / 160 : on ATTEND process-avatar, sinon la réponse ne
    // pourrait pas les porter. Un échec ne fait pas tomber la route.
    let derived: AvatarRow = row
    try {
      const { error: processError } = await auth.supabase.functions.invoke('process-avatar', {
        body: {
          artisan_id: auth.artisan.id,
          attachment_id: row.id,
          image_url: upload.url,
          mime_type: mimeType,
        },
      })
      if (processError) {
        console.warn('[portal-external] process-avatar en échec :', processError.message)
      } else {
        const { data: refreshed } = await auth.supabase
          .from('artisan_attachments')
          .select(AVATAR_SELECT)
          .eq('id', row.id)
          .maybeSingle()
        if (refreshed) derived = refreshed as AvatarRow
      }
    } catch (error) {
      console.warn('[portal-external] process-avatar injoignable :', error)
    }

    await recordArtisanDocumentAction(auth.supabase, {
      artisanId: auth.artisan.id,
      actionType: 'AVATAR_CHANGED',
      source: 'portal',
      actorLabel: `${artisanDisplayName(auth.artisan)} (artisan)`,
      attachmentId: row.id,
      eventUid,
      payload: { mode: 'photo', filename, sizes: AVATAR_SIZES },
    })

    return NextResponse.json({ avatar: avatarPayload(derived) }, { status: 201 })
  } catch (error) {
    return portalInternalError('me/profile-photo POST', error)
  }
}
