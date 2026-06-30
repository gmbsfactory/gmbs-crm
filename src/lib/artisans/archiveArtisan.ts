import { artisanStatusesApi, artisansApi, commentsApi } from "@/lib/api"

type ArchiveArtisanParams = {
  artisanId: string
  /** Motif d'archivage saisi par l'utilisateur (obligatoire métier). */
  reason: string
  /** Id de l'utilisateur courant, pour tracer l'auteur du commentaire. */
  authorId?: string
}

/**
 * Archive un artisan CÔTÉ CLIENT, à l'identique du chemin "édition via modal".
 *
 * Pourquoi côté client : les appels passent par `artisansApi`/`commentsApi`, qui
 * tapent les Edge Functions avec le JWT de l'utilisateur connecté (présent dans
 * le navigateur). L'Edge Function `comments` exige un utilisateur authentifié
 * (`requireAuth`). Un détour par une route serveur Next.js perdrait cette identité
 * (le code serveur retombe sur la clé service-role, qui n'est pas un *utilisateur*)
 * → 401 "Authentication required". Voir artisan-archive-context-menu-anon-rls-bug.
 *
 * Archiver = passer au statut ARCHIVE (is_active reste true : archive ≠ soft-delete).
 */
export async function archiveArtisan({ artisanId, reason, authorId }: ArchiveArtisanParams) {
  // Résolution de l'id ARCHIVE via le client authentifié (RLS `authenticated` OK).
  const statuses = await artisanStatusesApi.getAll()
  const archiveStatus = statuses.find((s) => s.code === "ARCHIVE" && s.is_active)
  if (!archiveStatus) {
    throw new Error("Statut d'archivage introuvable")
  }

  const updated = await artisansApi.update(artisanId, { statut_id: archiveStatus.id })

  // Commentaire de motif, identique au modal (comment_type "internal" + reason_type).
  await commentsApi.create({
    entity_id: artisanId,
    entity_type: "artisan",
    content: reason.trim(),
    comment_type: "internal",
    is_internal: true,
    author_id: authorId,
    reason_type: "archive",
  })

  return updated
}
