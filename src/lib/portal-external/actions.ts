import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Journal des actions de l'artisan — `artisan_portal_actions` (migration 99079).
 *
 * Ce module porte deux choses, et rien d'autre :
 *  1. l'**enveloppe d'idempotence** `{ event_uid, occurred_at? }` imposée à toute
 *     écriture du portail — le téléphone travaille hors ligne et rejoue ;
 *  2. l'**écriture du journal**, append-only, avec l'acteur et le contexte
 *     dénormalisé qui rendent la ligne lisible après la suppression de son objet.
 *
 * Le journal n'est **pas** une source de vérité : les états vivent sur
 * `intervention_artisans` et `artisan_reports`. Il n'est pas non plus publié en
 * temps réel.
 */

/** Types d'action du CHECK fermé de `artisan_portal_actions.action_type`. */
export type ArtisanActionType =
  | 'PRICE_ACCEPTED'
  | 'PRICE_REFUSED'
  | 'WORK_STARTED'
  | 'REPORT_SUBMITTED'
  | 'REPORT_REPLACED'
  | 'PHOTO_UPLOADED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'AVATAR_CHANGED'
  | 'DECHARGE_SIGNED'
  | 'REPORT_APPROVED'
  | 'REPORT_REJECTED'

/** Longueur maximale acceptée pour une clé d'idempotence. */
export const MAX_EVENT_UID_LENGTH = 200

/** Tolérance vers le futur, alignée sur le CHECK de 99079. */
const FUTUR_MAX_MS = 5 * 60 * 1000
/** Tolérance vers le passé, alignée sur le CHECK de 99079. */
const PASSE_MAX_MS = 7 * 24 * 60 * 60 * 1000

export interface EventEnvelope {
  event_uid: string
  /** Horodatage déclaré par le téléphone, brut. */
  occurred_at_declared: string | null
}

export type EnvelopeValidation =
  | { ok: true; value: EventEnvelope }
  | { ok: false; error: string }

/**
 * Valide l'enveloppe d'idempotence commune à toutes les écritures du portail.
 * `event_uid` est requis ; `occurred_at`, facultatif, n'est jamais un motif de
 * rejet — il est recalé par `normalizeOccurredAt`.
 */
export function validateEventEnvelope(body: Record<string, unknown>): EnvelopeValidation {
  const uid = body.event_uid
  if (typeof uid !== 'string' || uid.trim().length === 0) {
    return { ok: false, error: 'event_uid required' }
  }
  if (uid.trim().length > MAX_EVENT_UID_LENGTH) {
    return { ok: false, error: `event_uid too long (max ${MAX_EVENT_UID_LENGTH})` }
  }
  const declared = body.occurred_at
  return {
    ok: true,
    value: {
      event_uid: uid.trim(),
      occurred_at_declared: typeof declared === 'string' && declared.trim() ? declared.trim() : null,
    },
  }
}

export interface NormalizedClock {
  /** Horodatage retenu, toujours dans les bornes du CHECK de 99079. */
  occurred_at: string
  /** Horodatage posé par le serveur : fait foi pour l'audit. */
  recorded_at: string
  /** Fragments à fusionner dans `payload` quand l'horloge du téléphone dérive. */
  skew: Record<string, unknown>
}

/**
 * Recale l'horodatage déclaré dans `[recorded_at − 7 j, recorded_at + 5 min]`.
 *
 * **Un fait n'est jamais rejeté pour une horloge fausse** : hors bornes (ou
 * illisible), on conserve la valeur brute dans `payload.occurred_at_declared`,
 * on aligne `occurred_at` sur `recorded_at` et on pose `payload.clock_skew`.
 * Le CHECK en base n'est qu'un filet ; le recalage se fait ici.
 */
export function normalizeOccurredAt(declared: string | null, now: Date = new Date()): NormalizedClock {
  const recordedAt = now.toISOString()
  if (!declared) return { occurred_at: recordedAt, recorded_at: recordedAt, skew: {} }

  const parsed = new Date(declared)
  const ecart = parsed.getTime() - now.getTime()
  const valide = !Number.isNaN(parsed.getTime()) && ecart <= FUTUR_MAX_MS && -ecart <= PASSE_MAX_MS
  if (valide) {
    return { occurred_at: parsed.toISOString(), recorded_at: recordedAt, skew: {} }
  }
  return {
    occurred_at: recordedAt,
    recorded_at: recordedAt,
    skew: { occurred_at_declared: declared, clock_skew: true },
  }
}

export interface RecordedAction {
  id: string
  action_type: string
  payload: Record<string, unknown>
  occurred_at: string
  recorded_at: string
}

/**
 * Recherche une action déjà journalisée pour ce couple **(artisan, event_uid)**.
 *
 * Le lookup porte sur les deux colonnes, jamais sur `event_uid` seul : la clé
 * est générée par le téléphone, donc deux appareils produisant la même chaîne
 * (« evt-1 », un compteur local) se bloqueraient — et le `200` de rejeu rendrait
 * la trace d'un artisan à un autre.
 */
export async function findRecordedAction(
  supabase: SupabaseClient,
  artisanId: string,
  eventUid: string,
): Promise<RecordedAction | null> {
  const { data } = await supabase
    .from('artisan_portal_actions')
    .select('id, action_type, payload, occurred_at, recorded_at')
    .eq('artisan_id', artisanId)
    .eq('event_uid', eventUid)
    .maybeSingle()
  return (data as RecordedAction | null) ?? null
}

export interface RecordActionInput {
  artisanId: string
  actionType: ArtisanActionType
  /** `portal` = geste de l'artisan ; `crm` = saisie du gestionnaire (repli téléphone). */
  source?: 'portal' | 'crm'
  interventionId?: string | null
  reportId?: string | null
  attachmentId?: string | null
  /** Requis quand `source = 'crm'` : contrainte `artisan_portal_actions_acteur_check`. */
  actorUserId?: string | null
  /**
   * Identité immuable de l'acteur (e-mail ou nom), recopiée dans `payload.actor`.
   * `actor_user_id` est `ON DELETE SET NULL` : sans cette copie, la suppression
   * d'un compte effacerait l'attribution de toutes ses saisies.
   */
  actorLabel?: string | null
  /** Référence lisible de l'intervention, dénormalisée pour survivre à sa suppression. */
  intervention?: { id: string; id_inter: string | null; adresse: string | null } | null
  payload?: Record<string, unknown>
  envelope?: EventEnvelope | null
  clock?: NormalizedClock
}

/**
 * Écrit une ligne de journal. **N'échoue jamais l'appelant** : le fait métier
 * (prix accepté, chantier démarré) est déjà enregistré sur `intervention_artisans`
 * et ne doit pas être perdu parce que sa trace n'a pas pu s'écrire. L'échec est
 * journalisé côté serveur pour être vu en supervision.
 */
export async function recordArtisanAction(
  supabase: SupabaseClient,
  input: RecordActionInput,
): Promise<RecordedAction | null> {
  const clock = input.clock ?? normalizeOccurredAt(input.envelope?.occurred_at_declared ?? null)
  const source = input.source ?? 'portal'

  const payload: Record<string, unknown> = {
    ...(input.payload ?? {}),
    ...clock.skew,
  }
  if (input.intervention) {
    payload.intervention = {
      id: input.intervention.id,
      id_inter: input.intervention.id_inter,
      adresse: input.intervention.adresse,
    }
  }
  if (input.actorLabel) payload.actor = input.actorLabel

  const { data, error } = await supabase
    .from('artisan_portal_actions')
    .insert({
      artisan_id: input.artisanId,
      actor_user_id: input.actorUserId ?? null,
      source,
      intervention_id: input.interventionId ?? null,
      report_id: input.reportId ?? null,
      attachment_id: input.attachmentId ?? null,
      action_type: input.actionType,
      payload,
      occurred_at: clock.occurred_at,
      recorded_at: clock.recorded_at,
      event_uid: input.envelope?.event_uid ?? null,
    })
    .select('id, action_type, payload, occurred_at, recorded_at')
    .single()

  if (error) {
    // 23505 = rejeu concurrent sur (artisan_id, event_uid) : la trace existe déjà.
    if (error.code !== '23505') {
      console.error('[portal-external] Journal des actions non écrit :', error.message)
    }
    return null
  }
  return data as RecordedAction
}
