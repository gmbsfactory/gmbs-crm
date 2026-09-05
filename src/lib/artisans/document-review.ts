/**
 * Vérification des pièces du dossier artisan (lot L5, spec §5.5 et §6.6).
 *
 * Module PUR : aucune dépendance à Supabase ni à React, il est donc partagé
 * entre la route serveur `POST /api/artisans/{id}/documents/{attachmentId}/review`
 * et les composants de la fiche artisan.
 *
 * Règle centrale : **le motif est obligatoire au refus**. Sans lui, l'artisan
 * redépose exactement la même pièce et le gestionnaire refait le travail —
 * c'est la contradiction directe avec l'objectif 17 relevée par la spécification.
 */

/** Les deux seules décisions qu'un gestionnaire peut prendre sur une pièce. */
export const REVIEW_DECISIONS = ['approved', 'rejected'] as const
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number]

/** Valeurs admises par le CHECK de `artisan_attachments.review_status` (99076). */
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

/** Longueur maximale d'un motif de refus, alignée sur la revue des rapports. */
export const MAX_REVIEW_COMMENT_LENGTH = 2000

/**
 * Violet de la pastille « pièces à vérifier ».
 * **Le même** que le badge « À vérifier » des rapports
 * (`src/lib/interventions/portal-report-status.ts`) : même geste métier,
 * une seule couleur à apprendre pour le gestionnaire.
 */
export const PIECES_A_VERIFIER_COLOR = '#9333EA'

export type ReviewBody =
  | { ok: true; decision: ReviewDecision; comment: string | null; validUntil: string | null }
  | { ok: false; status: 400; error: string }

/**
 * Valide le corps de la route de revue.
 *
 * - `decision` doit valoir `approved` ou `rejected` ;
 * - `comment` est **obligatoire** (non vide) quand `decision = 'rejected'` ;
 * - `valid_until` est facultatif : une date `AAAA-MM-JJ` réellement existante
 *   (une date de validité de pièce — Kbis de moins de 3 mois, assurance
 *   annuelle…). Elle est rangée dans `metadata.valid_until`, aucune colonne
 *   n'est créée pour elle.
 */
export function parseReviewBody(body: Record<string, unknown> | null | undefined): ReviewBody {
  const decision = body?.decision
  if (typeof decision !== 'string' || !(REVIEW_DECISIONS as readonly string[]).includes(decision)) {
    return { ok: false, status: 400, error: "decision must be 'approved' or 'rejected'" }
  }

  const rawComment = typeof body?.comment === 'string' ? body.comment.trim() : ''
  const comment = rawComment.slice(0, MAX_REVIEW_COMMENT_LENGTH)

  if (decision === 'rejected' && !comment) {
    return { ok: false, status: 400, error: 'Un motif est obligatoire pour refuser une pièce' }
  }

  const rawValidUntil = body?.valid_until
  let validUntil: string | null = null
  if (rawValidUntil !== undefined && rawValidUntil !== null && rawValidUntil !== '') {
    if (typeof rawValidUntil !== 'string' || !isCalendarDate(rawValidUntil)) {
      return { ok: false, status: 400, error: 'valid_until doit être une date au format AAAA-MM-JJ' }
    }
    validUntil = rawValidUntil
  }

  return { ok: true, decision: decision as ReviewDecision, comment: comment || null, validUntil }
}

/** Vrai si la chaîne est une date `AAAA-MM-JJ` qui existe réellement au calendrier. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [annee, mois, jour] = value.split('-').map(Number)
  const date = new Date(Date.UTC(annee, mois - 1, jour))
  return (
    date.getUTCFullYear() === annee &&
    date.getUTCMonth() === mois - 1 &&
    date.getUTCDate() === jour
  )
}

/**
 * Libellé de l'état d'une pièce, côté gestionnaire.
 * `null` (historique) et `approved` se lisent tous deux « Validée » : le
 * DEFAULT `'approved'` de 99076 protège les milliers de pièces d'avant le portail.
 */
export function reviewLabel(reviewStatus: string | null | undefined): string {
  switch (reviewStatus) {
    case 'pending':
      return 'À vérifier'
    case 'rejected':
      return 'Refusée'
    default:
      return 'Validée'
  }
}

/**
 * Une pièce a-t-elle fait l'objet d'une décision **humaine** ?
 *
 * `review_status` a pour DEFAULT `'approved'` : « validée » et « jamais
 * regardée » y sont indiscernables. Seul `reviewed_at` distingue les deux, et
 * c'est lui qui conditionne la mention « vérifiée le … ».
 */
export function estVerifiee(reviewedAt: string | null | undefined): boolean {
  return Boolean(reviewedAt)
}

/**
 * Fusionne la date de validité dans les métadonnées existantes sans rien perdre
 * (`metadata.source = 'portal'` doit survivre : c'est lui qui déclenche le
 * temps réel de `usePortalLiveSync`).
 */
export function mergeValidUntil(
  metadata: Record<string, unknown> | null | undefined,
  validUntil: string | null,
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) }
  if (validUntil) base.valid_until = validUntil
  else delete base.valid_until
  return base
}
