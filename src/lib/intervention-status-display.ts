import type { InterventionStatusValue } from '@/types/interventions'

// Type étendu pour inclure les statuts supplémentaires
type ExtendedStatusCode = InterventionStatusValue | 'DEVIS_VALIDE' | 'PLANIFICATION' | 'ANNULEE' | 'EN_ATTENTE_CLIENT'

interface StatusDisplay {
  code: ExtendedStatusCode
  label: string
  color: string
  variant: 'default' | 'warning' | 'success' | 'danger' | 'info'
  isWaitingVerification?: boolean
}

/**
 * Retourne l'affichage du statut en tenant compte de la présence d'un rapport portal
 *
 * Logique spéciale :
 * - Si statut = INTER_EN_COURS + has_portal_report = true → afficher "À vérifier" (violet)
 * - Sinon, affichage normal selon le statut
 *
 * @param statusCode - Code du statut de l'intervention
 * @param hasPortalReport - Booléen indiquant si un rapport portal a été soumis
 * @returns Configuration d'affichage du statut
 */
export function getInterventionStatusDisplay(
  statusCode: ExtendedStatusCode | null,
  hasPortalReport: boolean
): StatusDisplay {
  // Cas spécial : INTER_EN_COURS + rapport soumis → afficher "À vérifier"
  if (statusCode === 'INTER_EN_COURS' && hasPortalReport) {
    return {
      code: 'INTER_EN_COURS',
      label: 'À vérifier',
      color: '#9333EA',  // Purple-600
      variant: 'warning',
      isWaitingVerification: true
    }
  }

  // Affichage normal selon le statut
  switch (statusCode) {
    case 'DEMANDE':
      return {
        code: 'DEMANDE',
        label: 'Demande',
        color: '#6B7280',  // Gray-500
        variant: 'default'
      }

    case 'DEVIS_ENVOYE':
      return {
        code: 'DEVIS_ENVOYE',
        label: 'Devis envoyé',
        color: '#3B82F6',  // Blue-500
        variant: 'info'
      }

    case 'DEVIS_VALIDE':
      return {
        code: 'DEVIS_VALIDE',
        label: 'Devis validé',
        color: '#10B981',  // Green-500
        variant: 'success'
      }

    case 'PLANIFICATION':
      return {
        code: 'PLANIFICATION',
        label: 'Planification',
        color: '#F59E0B',  // Amber-500
        variant: 'warning'
      }

    case 'INTER_EN_COURS':
      return {
        code: 'INTER_EN_COURS',
        label: 'En cours',
        color: '#3B82F6',  // Blue-500
        variant: 'info'
      }

    case 'INTER_TERMINEE':
      return {
        code: 'INTER_TERMINEE',
        label: 'Terminée',
        color: '#10B981',  // Green-500
        variant: 'success'
      }

    case 'ANNULEE':
      return {
        code: 'ANNULEE',
        label: 'Annulée',
        color: '#EF4444',  // Red-500
        variant: 'danger'
      }

    case 'EN_ATTENTE_CLIENT':
      return {
        code: 'EN_ATTENTE_CLIENT',
        label: 'En attente client',
        color: '#F59E0B',  // Amber-500
        variant: 'warning'
      }

    default:
      return {
        code: statusCode || 'DEMANDE',
        label: statusCode || 'Demande',
        color: '#6B7280',
        variant: 'default'
      }
  }
}

/**
 * Vérifie si une intervention est en attente de validation de rapport
 */
export function isWaitingReportValidation(
  statusCode: ExtendedStatusCode | null,
  hasPortalReport: boolean
): boolean {
  return statusCode === 'INTER_EN_COURS' && hasPortalReport
}
