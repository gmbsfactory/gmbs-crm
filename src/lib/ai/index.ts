// ===== COUCHE IA - FACADE =====
// Point d'entree unique pour toute la logique IA du CRM.
//
// Usage:
//   import { detectContext, anonymizeIntervention, buildPrompt } from '@/lib/ai'
//   import type { AIActionType, AIPageContext } from '@/lib/ai'

// Types
export type {
  AIActionType,
  AIActionButtonType,
  AIActionPayload,
  AIPageContext,
  CRMPage,
  AnonymizedIntervention,
  AnonymizedArtisan,
  AIContextualActionRequest,
  AIContextualActionResponse,
  AIResultSection,
  AISuggestedAction,
  AIActionState,
  AIDataSummary,
} from './types'

// Context detection
export {
  detectContext,
  isActionAvailable,
  getDefaultAction,
  enrichContextWithView,
} from './context-detector'

// Anonymization (RGPD)
export {
  anonymizeIntervention,
  anonymizeArtisan,
} from './anonymize'

// Prompts
export {
  buildPrompt,
  buildDataSummaryPrompt,
  ACTION_LABELS,
  ACTION_DESCRIPTIONS,
} from './prompts'

// History context builder
export {
  buildHistoryContext,
} from './history-context-builder'
export type { InterventionHistoryContext } from './history-context-builder'
