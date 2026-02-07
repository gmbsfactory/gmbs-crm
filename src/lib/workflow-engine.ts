import { AUTHORIZED_TRANSITIONS, VALIDATION_RULES } from "@/config/workflow-rules"
import { STATUS_CHAIN_CONFIG } from "@/config/intervention-status-chains"
import { getCumulativeEntryRules } from "@/lib/workflow/cumulative-validation"
import type {
  TransitionCondition,
  WorkflowConfig,
  WorkflowValidationResult,
  WorkflowEntityContext,
  WorkflowStatus,
  WorkflowTransition,
} from "@/types/intervention-workflow"
import type { InterventionStatusValue } from "@/types/interventions"

export function validateTransition(
  workflow: WorkflowConfig,
  fromStatusKey: string,
  toStatusKey: string,
  context: WorkflowEntityContext,
): WorkflowValidationResult {
  const fromStatus = workflow.statuses.find((status) => status.key === fromStatusKey)
  const toStatus = workflow.statuses.find((status) => status.key === toStatusKey)
  if (!fromStatus || !toStatus) {
    return {
      canTransition: false,
      missingRequirements: [],
      failedConditions: ["Statut source ou cible introuvable"],
    }
  }

  const transition = workflow.transitions.find(
    (candidate) => candidate.fromStatusId === fromStatus.id && candidate.toStatusId === toStatus.id,
  )

  if (!transition || !transition.isActive) {
    return {
      canTransition: false,
      missingRequirements: [],
      failedConditions: ["Transition non autorisée"],
    }
  }

  const missingRequirements = collectMissingRequirements(toStatus, context)
  const failedConditions = evaluateConditions(transition.conditions, context)

  const isAuthorized = AUTHORIZED_TRANSITIONS.some(
    (candidate) => candidate.from === (fromStatus.key as InterventionStatusValue) && candidate.to === (toStatus.key as InterventionStatusValue),
  )

  if (!isAuthorized) {
    failedConditions.push("Transition non autorisée par la configuration du workflow")
  }

  const seenMessages = new Set<string>()

  VALIDATION_RULES.forEach((rule) => {
    if (rule.from && rule.from !== fromStatus.key) return
    if (rule.to && rule.to !== toStatus.key) return
    if (rule.statuses && !rule.statuses.includes(toStatus.key as InterventionStatusValue)) return
    if (!rule.validate(context)) {
      if (!seenMessages.has(rule.message)) {
        seenMessages.add(rule.message)
        failedConditions.push(rule.message)
      }
    }
  })

  // Validation cumulative : en mode strict, appliquer aussi les règles
  // d'entrée de tous les statuts prédécesseurs sur la chaîne principale
  if (STATUS_CHAIN_CONFIG.validationMode === 'strict') {
    const cumulativeRules = getCumulativeEntryRules(
      toStatus.key as InterventionStatusValue
    )
    cumulativeRules.forEach((rule) => {
      if (!rule.validate(context)) {
        if (!seenMessages.has(rule.message)) {
          seenMessages.add(rule.message)
          failedConditions.push(rule.message)
        }
      }
    })
  }

  return {
    canTransition: missingRequirements.length === 0 && failedConditions.length === 0,
    missingRequirements,
    failedConditions,
  }
}

function collectMissingRequirements(status: WorkflowStatus, context: WorkflowEntityContext): string[] {
  const missing: string[] = []

  if (status.metadata?.requiresArtisan && !context.artisanId) {
    missing.push("artisanId")
  }

  if (status.metadata?.requiresFacture && !context.factureId) {
    missing.push("factureId")
  }

  if (status.metadata?.requiresProprietaire && !context.proprietaireId) {
    missing.push("proprietaireId")
  }

  if (status.metadata?.requiresCommentaire && !context.commentaire) {
    missing.push("commentaire")
  }

  if (status.metadata?.requiresCommentaire && context.commentaire && !context.commentaire.toString().trim()) {
    missing.push("commentaire")
  }

  if (status.metadata?.requiresDevisId && !context.devisId) {
    missing.push("devisId")
  }

  return missing
}

function evaluateConditions(conditions: TransitionCondition[], context: WorkflowEntityContext): string[] {
  const failed: string[] = []

  conditions.forEach((condition) => {
    switch (condition.type) {
      case "field_required": {
        const value = context[condition.field ?? ""]
        if (value == null || value === "") {
          failed.push(condition.message)
        }
        break
      }
      case "field_equals": {
        const value = context[condition.field ?? ""]
        if (value !== condition.value) {
          failed.push(condition.message)
        }
        break
      }
      case "custom_validation": {
        failed.push(condition.message)
        break
      }
    }
  })

  return failed
}

export function findAvailableTransitions(
  workflow: WorkflowConfig,
  statusKey: string,
): WorkflowTransition[] {
  const status = workflow.statuses.find((item) => item.key === statusKey)
  if (!status) return []
  return workflow.transitions.filter((transition) => transition.fromStatusId === status.id && transition.isActive)
}
