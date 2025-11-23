import type { InterventionPayment } from '@/lib/api/v2/common/types'

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
