import type { InterventionPayment } from '@/lib/api/common/types'
import { isCostSpecified } from '@/lib/interventions/derivations'

export function isDepositReceived(payment: InterventionPayment | undefined): boolean {
    return payment?.is_received === true &&
        payment?.payment_date !== null &&
        payment?.payment_date !== undefined
}

export function isSSTDepositReceived(payment: InterventionPayment | undefined): boolean {
    return isDepositReceived(payment) && payment?.payment_type === 'acompte_sst'
}

export function isClientDepositReceived(payment: InterventionPayment | undefined): boolean {
    return isDepositReceived(payment) && payment?.payment_type === 'acompte_client'
}

export function hasAnyDepositReceived(
    sstPayment: InterventionPayment | undefined,
    clientPayment: InterventionPayment | undefined
): boolean {
    return isSSTDepositReceived(sstPayment) || isClientDepositReceived(clientPayment)
}

/**
 * Date du jour au format YYYY-MM-DD, en heure LOCALE (pas UTC).
 * Important pour ne pas afficher "demain" à un utilisateur qui coche en soirée.
 */
export function todayLocalISO(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Règle métier : cocher "Reçu/Envoyé" implique une date de paiement.
 * - Cocher sans date → date = aujourd'hui (auto-fill, restera éditable côté UI).
 * - Cocher avec date existante → on garde la date saisie.
 * - Décocher → on vide la date pour ne pas laisser de valeur orpheline.
 */
export function applyRecuToggle(
    checked: boolean,
    currentDate: string,
): { recu: boolean; date: string } {
    if (checked) {
        return { recu: true, date: currentDate || todayLocalISO() }
    }
    return { recu: false, date: '' }
}

/**
 * Statuts depuis lesquels la saisie d'un acompte est ouverte.
 * Hors de ces statuts, la section « Gestion des acomptes » est en lecture seule.
 */
export const DEPOSIT_EDITABLE_STATUS_CODES = ['DEVIS_ENVOYE', 'ACCEPTE', 'ATT_ACOMPTE'] as const

/**
 * Statuts depuis lesquels l'acompte client peut être marqué « Reçu ».
 * Depuis DEVIS_ENVOYE la saisie du montant bascule d'abord en ATT_ACOMPTE :
 * on ne saute pas l'étape d'attente.
 */
export const DEPOSIT_RECEIPT_STATUS_CODES = ['ACCEPTE', 'ATT_ACOMPTE'] as const

export function canEditDeposits(statusCode: string | undefined | null): boolean {
    return (DEPOSIT_EDITABLE_STATUS_CODES as readonly string[]).includes(statusCode ?? '')
}

/**
 * Un acompte est « saisi » dès qu'une valeur numérique >= 0 est renseignée.
 *
 * 0 est une valeur métier valide (acompte nul explicitement acté) et se distingue
 * du champ laissé vide, qui lui ne déclenche aucune automatisation de statut.
 * Même sémantique que `isCostSpecified` pour les coûts.
 */
export function isDepositSpecified(amount: string | null | undefined): boolean {
    return isCostSpecified(amount)
}

/**
 * « Reçu » n'a de sens que sur un acompte qui existe : tant que le montant n'est
 * pas saisi (champ vide), la case est verrouillée. Un acompte à 0 est, lui,
 * cochable — il peut être « perçu » au sens métier.
 */
export function canMarkDepositReceived(
    statusCode: string | undefined | null,
    amount: string | undefined | null,
): boolean {
    return (
        (DEPOSIT_RECEIPT_STATUS_CODES as readonly string[]).includes(statusCode ?? '') &&
        isDepositSpecified(amount)
    )
}

/**
 * Statut cible impliqué par l'état de l'acompte CLIENT, ou `null` si l'acompte
 * n'impose rien (statut hors périmètre, ou montant non saisi).
 * - Montant saisi + « Reçu » coché → ACCEPTE (affiché « Accepté $ »)
 * - Montant saisi seul             → ATT_ACOMPTE
 */
export function resolveDepositStatusCode(params: {
    currentStatusCode: string | undefined | null
    amount: string | undefined | null
    recu: boolean
}): string | null {
    const { currentStatusCode, amount, recu } = params
    if (!canEditDeposits(currentStatusCode)) return null
    if (!isDepositSpecified(amount)) return null
    return recu ? 'ACCEPTE' : 'ATT_ACOMPTE'
}

/**
 * Règle bloquante : un acompte client coché « Reçu » doit porter la date à
 * laquelle il a été perçu. Retourne le message d'erreur, ou `null` si valide.
 */
export function getDepositValidationError(params: {
    recu: boolean
    date: string | undefined | null
}): string | null {
    if (params.recu && !params.date?.trim()) {
        return "La date de réception de l'acompte est obligatoire lorsque « Reçu » est coché"
    }
    return null
}

export function getStatusDisplayLabel(
    statusCode: string | undefined,
    statusLabel: string,
    sstPayment?: InterventionPayment,
    clientPayment?: InterventionPayment
): string {
    if (statusCode === 'ACCEPTE' && hasAnyDepositReceived(sstPayment, clientPayment)) {
        return `${statusLabel} $`
    }
    return statusLabel
}
