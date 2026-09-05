/**
 * Statut de paiement d'un artisan sur une intervention — module pur.
 *
 * Principe P1 de la spécification « vision portail » : **le CRM est la seule
 * source de vérité**. Le libellé montré à l'artisan est calculé ici et transmis
 * tel quel ; le portail ne rejoue aucune règle. Précédent à ne pas répéter : les
 * couleurs de statut sont déjà dupliquées entre `globals.css` et le `status.ts`
 * du portail, et c'est une incohérence silencieuse à chaque ajout d'état.
 *
 * Ces quatre valeurs sont celles du CHECK de `intervention_artisans.payment_status`
 * (migration 99078). Ajouter un état ici sans le poser en base — ou l'inverse —
 * est une divergence : les deux listes se lisent ensemble.
 *
 * **Jamais dérivé de `intervention_payments`** : `is_received` est un encaissement
 * *client*, et `acompte_sst` n'a pas d'`artisan_order` — donc faux dès qu'une
 * intervention porte deux artisans. `payment_status` est une saisie du
 * gestionnaire, pas une dérivation.
 */

export const PAYMENT_STATUSES = ['not_applicable', 'awaiting_invoice', 'in_progress', 'paid'] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** Ton d'affichage associé à l'état, pour que le portail n'ait pas à le déduire. */
export type PaymentTone = 'neutral' | 'warning' | 'info' | 'success'

export interface PaymentDisplay {
  state: PaymentStatus
  /** Libellé destiné à l'artisan. `null` pour `not_applicable` : on n'affiche rien. */
  label: string | null
  tone: PaymentTone
}

const DISPLAY: Record<PaymentStatus, { label: string | null; tone: PaymentTone }> = {
  not_applicable: { label: null, tone: 'neutral' },
  awaiting_invoice: { label: 'En attente de votre facture', tone: 'warning' },
  in_progress: { label: 'Paiement en cours', tone: 'info' },
  paid: { label: 'Payé', tone: 'success' },
}

/** Vrai si la valeur fait partie des quatre états connus. */
export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value)
}

/**
 * Libellé et ton d'un statut de paiement.
 * Une valeur inconnue (état ajouté en base sans être ajouté ici) retombe sur
 * `not_applicable` : l'artisan ne voit rien plutôt qu'un libellé faux.
 */
export function describePaymentStatus(state: unknown, paidAt?: string | null): PaymentDisplay {
  const value: PaymentStatus = isPaymentStatus(state) ? state : 'not_applicable'
  const { label, tone } = DISPLAY[value]
  if (value === 'paid' && paidAt) {
    // Une date illisible ne doit pas produire « Payé le  » : on retombe sur
    // le libellé nu plutôt que sur une phrase tronquée.
    const jour = formatJour(paidAt)
    if (jour) return { state: value, label: `Payé le ${jour}`, tone }
  }
  return { state: value, label, tone }
}

/**
 * Date au format court français (`20/09`), forcée sur `Europe/Paris` :
 * la route s'exécute sur un serveur dont le fuseau n'est pas garanti, et un
 * paiement enregistré en fin de journée ne doit pas s'afficher au lendemain.
 */
function formatJour(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(date)
}
