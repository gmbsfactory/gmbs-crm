import type { InterventionStatusValue } from '@/types/interventions'
import { CUMULATIVE_VALIDATION_CHAIN } from '@/config/intervention-status-chains'
import { VALIDATION_RULES } from '@/config/workflow-rules'

/**
 * Retourne tous les statuts prédécesseurs (exclusif) du statut cible
 * sur la chaîne cumulative.
 * Retourne un tableau vide si le statut n'est pas sur la chaîne
 * ou s'il est le premier élément (DEMANDE).
 */
export function getPredecessorStatuses(
  targetStatus: InterventionStatusValue
): InterventionStatusValue[] {
  const index = CUMULATIVE_VALIDATION_CHAIN.indexOf(targetStatus)
  if (index <= 0) return []
  return CUMULATIVE_VALIDATION_CHAIN.slice(0, index) as InterventionStatusValue[]
}

/**
 * Vérifie si un statut fait partie de la chaîne cumulative.
 */
export function isOnCumulativeChain(
  status: InterventionStatusValue
): boolean {
  return CUMULATIVE_VALIDATION_CHAIN.includes(status)
}

/**
 * Retourne les VALIDATION_RULES qui sont des prérequis d'entrée
 * pour un statut donné.
 *
 * Critères d'inclusion :
 * - `to` correspond au statut ET pas de contrainte `from` (règle d'entrée, pas de transition)
 * - `statuses` contient le statut (règle large)
 *
 * Les règles avec `from` sont spécifiques à une transition et sont exclues
 * pour éviter de les appliquer hors contexte.
 */
export function getEntryRulesForStatus(
  status: InterventionStatusValue
) {
  return VALIDATION_RULES.filter(rule => {
    if (rule.from) return false
    if (rule.to && rule.to === status) return true
    if (rule.statuses && rule.statuses.includes(status)) return true
    return false
  })
}

/**
 * Pour un statut cible sur la chaîne cumulative, retourne l'union
 * dédupliquée (par `key`) des règles d'entrée de tous les
 * statuts prédécesseurs.
 *
 * Pour les statuts hors chaîne, retourne un tableau vide.
 */
export function getCumulativeEntryRules(
  targetStatus: InterventionStatusValue
) {
  if (!isOnCumulativeChain(targetStatus)) return []

  const predecessors = getPredecessorStatuses(targetStatus)
  const seenKeys = new Set<string>()
  const cumulativeRules: typeof VALIDATION_RULES = []

  for (const predecessorStatus of predecessors) {
    const rules = getEntryRulesForStatus(predecessorStatus)
    for (const rule of rules) {
      if (!seenKeys.has(rule.key)) {
        seenKeys.add(rule.key)
        cumulativeRules.push(rule)
      }
    }
  }

  return cumulativeRules
}
