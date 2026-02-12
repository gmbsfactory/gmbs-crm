// ===== COUCHE IA - FACADE =====
// Point d'entree unique pour toute la logique IA du CRM.
//
// Usage:
//   import { detectContext, anonymizeIntervention, buildPrompt } from '@/lib/ai'
//   import type { AIActionType, AIPageContext } from '@/lib/ai'

// Types
export type {
  AIActionType,
  AIPageContext,
  CRMPage,
  AnonymizedIntervention,
  AnonymizedArtisan,
  AIContextualActionRequest,
  AIContextualActionResponse,
  AIResultSection,
  AISuggestedAction,
  AIActionState,
} from './types'

// Context detection
export {
  detectContext,
  isActionAvailable,
  getDefaultAction,
} from './context-detector'

// Anonymization (RGPD)
export {
  anonymizeIntervention,
  anonymizeArtisan,
} from './anonymize'

// Prompts
export {
  buildPrompt,
  ACTION_LABELS,
  ACTION_DESCRIPTIONS,
} from './prompts'
