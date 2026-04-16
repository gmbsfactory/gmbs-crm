import type { InterventionPayment } from '@/lib/api/common/types'

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
