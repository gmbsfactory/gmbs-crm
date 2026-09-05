import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Écriture dans le journal append-only `artisan_portal_actions` (migration
 * 99079) pour les gestes faits **depuis le CRM** sur le dossier d'un artisan.
 *
 * Le helper générique du portail (`src/lib/portal-external/actions.ts`, lot L1)
 * couvre les écritures venues du téléphone ; celui-ci couvre les décisions du
 * gestionnaire, qui n'ont ni jeton portail ni enveloppe d'idempotence.
 *
 * Trois contraintes de la base à respecter, sinon l'insertion est refusée :
 * - `source = 'crm'` **exige** un acteur : `actor_user_id` renseigné ou
 *   `payload.actor` (CHECK `artisan_portal_actions_acteur_check`) ;
 * - `occurred_at` doit rester dans `[recorded_at − 7 j, recorded_at + 5 min]` —
 *   ici les deux valent `now()`, la contrainte n'est qu'un filet ;
 * - le journal est **append-only** (trigger) : jamais d'UPDATE, jamais de DELETE.
 *
 * L'échec d'écriture du journal ne fait **jamais** échouer le geste métier :
 * la décision du gestionnaire est déjà enregistrée quand on arrive ici.
 */

/** Types d'action de ce lot ; le CHECK de 99079 en porte la liste fermée. */
export type ArtisanActionType =
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'AVATAR_CHANGED'
  /** Dépôt d'une pièce depuis le téléphone (`source = 'portal'`, lot L6). */
  | 'DOCUMENT_UPLOADED'

export interface ArtisanActionInput {
  artisanId: string
  actionType: ArtisanActionType
  /** `crm` = décision du gestionnaire, `portal` = geste de l'artisan. */
  source?: 'crm' | 'portal'
  actorUserId?: string | null
  /** Nom lisible de l'acteur : seul recours quand `actorUserId` est absent. */
  actorLabel?: string | null
  attachmentId?: string | null
  eventUid?: string | null
  payload?: Record<string, unknown>
}

export async function recordArtisanDocumentAction(
  supabase: SupabaseClient,
  action: ArtisanActionInput,
): Promise<void> {
  const source = action.source ?? 'crm'
  const payload: Record<string, unknown> = { ...(action.payload ?? {}) }

  // CHECK `artisan_portal_actions_acteur_check` : une action `crm` sans
  // `actor_user_id` ET sans `payload.actor` est rejetée en base. On pose donc
  // toujours le libellé, qui survit en plus à la suppression du compte
  // (`actor_user_id` est ON DELETE SET NULL — incident « artisan_audit_log
  // sans acteur »).
  if (action.actorLabel) payload.actor = action.actorLabel
  if (source === 'crm' && !action.actorUserId && !payload.actor) payload.actor = 'un gestionnaire'

  const { error } = await supabase.from('artisan_portal_actions').insert({
    artisan_id: action.artisanId,
    actor_user_id: action.actorUserId ?? null,
    source,
    attachment_id: action.attachmentId ?? null,
    action_type: action.actionType,
    payload,
    event_uid: action.eventUid ?? null,
  })

  if (error) {
    console.error(`[artisan-action-log] ${action.actionType} non journalisée :`, error.message)
  }
}
