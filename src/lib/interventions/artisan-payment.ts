import { PAYMENT_STATUSES, isPaymentStatus, type PaymentStatus } from '@/lib/interventions/payment-status'

/**
 * Lecture du corps de `PATCH /api/interventions/{id}/artisans/{artisanId}/payment`
 * — **module pur** (spécification §5.7, lot L6).
 *
 * Le statut de paiement est une **saisie du gestionnaire**, par ligne
 * d'affectation : sur une intervention à deux artisans, l'un peut être payé et
 * l'autre pas. Il n'est **jamais** dérivé d'`intervention_payments` :
 * `is_received` y désigne un encaissement *client* (l'argent que GMBS reçoit),
 * et `acompte_sst` n'a pas d'`artisan_order` — donc faux dès qu'il y a deux
 * artisans. Confondre les deux, c'est afficher « payé » à un artisan parce que
 * le client a réglé GMBS.
 */

export interface ParsedArtisanPayment {
  payment_status: PaymentStatus
  /** Date de paiement, exigée pour `paid` et remise à `null` pour tout autre état. */
  paid_at: string | null
}

export type ArtisanPaymentParse =
  | { ok: true; value: ParsedArtisanPayment }
  | { ok: false; status: 400; error: string }

/**
 * Valide `{ payment_status, paid_at? }`.
 *
 * - une valeur hors des quatre états connus est refusée **ici**, pas par le
 *   CHECK de la base : le message doit dire lequel est attendu ;
 * - `paid_at` est **obligatoire** pour `paid`. « Payé le … » est ce que lit
 *   l'artisan ; « Payé » sans date lui fait rouvrir le dossier pour savoir
 *   quand ;
 * - `paid_at` est effacé dès que l'état n'est plus `paid` : une date de
 *   paiement survivant à un retour en litige serait un faux souvenir.
 */
export function parseArtisanPaymentBody(body: Record<string, unknown>): ArtisanPaymentParse {
  const statut = body.payment_status
  if (!isPaymentStatus(statut)) {
    return { ok: false, status: 400, error: `payment_status attendu parmi : ${PAYMENT_STATUSES.join(', ')}` }
  }

  const brut = body.paid_at
  if (statut !== 'paid') {
    return { ok: true, value: { payment_status: statut, paid_at: null } }
  }

  if (typeof brut !== 'string' || !brut.trim()) {
    return { ok: false, status: 400, error: 'paid_at est requis quand payment_status vaut « paid »' }
  }
  const date = new Date(brut.trim())
  if (Number.isNaN(date.getTime())) {
    return { ok: false, status: 400, error: 'paid_at doit être une date ISO valide' }
  }
  return { ok: true, value: { payment_status: statut, paid_at: date.toISOString() } }
}
