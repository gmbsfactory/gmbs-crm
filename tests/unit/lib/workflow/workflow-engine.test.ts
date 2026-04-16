import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  TransitionCondition,
  WorkflowConfig,
  WorkflowEntityContext,
  WorkflowStatus,
  WorkflowTransition,
} from '@/types/intervention-workflow'

// Mock the config modules so the engine is tested in isolation. This lets us
// precisely control AUTHORIZED_TRANSITIONS / VALIDATION_RULES / STATUS_CHAIN_CONFIG
// without coupling assertions to the real intervention workflow definitions.
vi.mock('@/config/workflow-rules', () => ({
  AUTHORIZED_TRANSITIONS: [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'C' },
    { from: 'A', to: 'C' },
  ],
  VALIDATION_RULES: [
    {
      from: 'A',
      to: 'B',
      message: 'Champ obligatoire X',
      validate: (ctx: WorkflowEntityContext) => Boolean(ctx.fieldX),
    },
    {
      statuses: ['C'],
      message: 'Doit avoir un artisan',
      validate: (ctx: WorkflowEntityContext) => Boolean(ctx.artisanId),
    },
    {
      // Rule without `from`/`to`/`statuses` always evaluates
      message: 'Toujours valide',
      validate: () => true,
    },
  ],
}))

vi.mock('@/config/intervention-status-chains', () => ({
  STATUS_CHAIN_CONFIG: { validationMode: 'permissive' },
}))

vi.mock('@/lib/workflow/cumulative-validation', () => ({
  getCumulativeEntryRules: vi.fn(() => []),
}))

import { validateTransition, findAvailableTransitions } from '@/lib/workflow-engine'
import { getCumulativeEntryRules } from '@/lib/workflow/cumulative-validation'
import { STATUS_CHAIN_CONFIG } from '@/config/intervention-status-chains'

const mutableChainConfig = STATUS_CHAIN_CONFIG as { validationMode: string }

function makeStatus(
  key: string,
  metadata: WorkflowStatus['metadata'] = {},
  overrides: Partial<WorkflowStatus> = {},
): WorkflowStatus {
  return {
    id: `status-${key}`,
    key,
    label: key,
    color: '#000',
    icon: 'circle',
    isTerminal: false,
    isInitial: false,
    position: { x: 0, y: 0 },
    metadata,
    ...overrides,
  }
}

function makeTransition(
  fromKey: string,
  toKey: string,
  overrides: Partial<WorkflowTransition> = {},
): WorkflowTransition {
  return {
    id: `t-${fromKey}-${toKey}`,
    fromStatusId: `status-${fromKey}`,
    toStatusId: `status-${toKey}`,
    label: `${fromKey}→${toKey}`,
    conditions: [],
    isActive: true,
    ...overrides,
  }
}

function makeWorkflow(
  statuses: WorkflowStatus[],
  transitions: WorkflowTransition[],
): WorkflowConfig {
  return {
    id: 'wf-1',
    name: 'Test workflow',
    version: '1',
    isActive: true,
    statuses,
    transitions,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }
}

describe('workflow-engine', () => {
  beforeEach(() => {
    vi.mocked(getCumulativeEntryRules).mockReturnValue([])
    mutableChainConfig.validationMode = 'permissive'
  })

  describe('validateTransition - status lookup', () => {
    it('should reject when source status is not found', () => {
      const workflow = makeWorkflow(
        [makeStatus('B')],
        [],
      )

      const result = validateTransition(workflow, 'UNKNOWN', 'B', {})

      expect(result.canTransition).toBe(false)
      expect(result.failedConditions).toContain('Statut source ou cible introuvable')
    })

    it('should reject when target status is not found', () => {
      const workflow = makeWorkflow(
        [makeStatus('A')],
        [],
      )

      const result = validateTransition(workflow, 'A', 'UNKNOWN', {})

      expect(result.canTransition).toBe(false)
      expect(result.failedConditions).toContain('Statut source ou cible introuvable')
    })
  })

  describe('validateTransition - transition lookup', () => {
    it('should reject when no transition exists between the two statuses', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [], // no transitions defined
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result.canTransition).toBe(false)
      expect(result.failedConditions).toContain('Transition non autorisée')
    })

    it('should reject when the transition exists but is inactive', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B', { isActive: false })],
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result.canTransition).toBe(false)
      expect(result.failedConditions).toContain('Transition non autorisée')
    })
  })

  describe('validateTransition - AUTHORIZED_TRANSITIONS gate', () => {
    it('should reject when the workflow allows the transition but it is not in AUTHORIZED_TRANSITIONS', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('Z')],
        [makeTransition('A', 'Z')],
      )

      const result = validateTransition(workflow, 'A', 'Z', {})

      expect(result.canTransition).toBe(false)
      expect(result.failedConditions).toContain(
        'Transition non autorisée par la configuration du workflow',
      )
    })
  })

  describe('validateTransition - collectMissingRequirements', () => {
    it('should report missing artisanId when requiresArtisan is set', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B', { requiresArtisan: true })],
        [makeTransition('A', 'B')],
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result.missingRequirements).toContain('artisanId')
      expect(result.canTransition).toBe(false)
    })

    it('should report missing factureId when requiresFacture is set', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B', { requiresFacture: true })],
        [makeTransition('A', 'B')],
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result.missingRequirements).toContain('factureId')
    })

    it('should report missing proprietaireId when requiresProprietaire is set', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B', { requiresProprietaire: true })],
        [makeTransition('A', 'B')],
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result.missingRequirements).toContain('proprietaireId')
    })

    it('should report missing devisId when requiresDevisId is set', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B', { requiresDevisId: true })],
        [makeTransition('A', 'B')],
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result.missingRequirements).toContain('devisId')
    })

    it('should report missing commentaire when requiresCommentaire and field absent', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B', { requiresCommentaire: true })],
        [makeTransition('A', 'B')],
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result.missingRequirements).toContain('commentaire')
    })

    it('should report missing commentaire when value is whitespace only', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B', { requiresCommentaire: true })],
        [makeTransition('A', 'B')],
      )

      const result = validateTransition(workflow, 'A', 'B', {
        fieldX: 'ok',
        commentaire: '   ',
      })

      expect(result.missingRequirements).toContain('commentaire')
    })

    it('should accept when all required metadata fields are present', () => {
      const workflow = makeWorkflow(
        [
          makeStatus('A'),
          makeStatus('B', {
            requiresArtisan: true,
            requiresFacture: true,
            requiresProprietaire: true,
            requiresCommentaire: true,
            requiresDevisId: true,
          }),
        ],
        [makeTransition('A', 'B')],
      )

      const result = validateTransition(workflow, 'A', 'B', {
        fieldX: 'ok',
        artisanId: 'a-1',
        factureId: 'f-1',
        proprietaireId: 'p-1',
        commentaire: 'note',
        devisId: 'd-1',
      })

      expect(result.missingRequirements).toEqual([])
      expect(result.canTransition).toBe(true)
    })
  })

  describe('validateTransition - evaluateConditions', () => {
    it('should fail field_required when value is null or empty string', () => {
      const condition: TransitionCondition = {
        type: 'field_required',
        field: 'agenceId',
        message: 'Agence requise',
      }
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B', { conditions: [condition] })],
      )

      const nullResult = validateTransition(workflow, 'A', 'B', {
        fieldX: 'ok',
        agenceId: null,
      })
      const emptyResult = validateTransition(workflow, 'A', 'B', {
        fieldX: 'ok',
        agenceId: '',
      })

      expect(nullResult.failedConditions).toContain('Agence requise')
      expect(emptyResult.failedConditions).toContain('Agence requise')
    })

    it('should pass field_required when value is present', () => {
      const condition: TransitionCondition = {
        type: 'field_required',
        field: 'agenceId',
        message: 'Agence requise',
      }
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B', { conditions: [condition] })],
      )

      const result = validateTransition(workflow, 'A', 'B', {
        fieldX: 'ok',
        agenceId: 'agence-1',
      })

      expect(result.failedConditions).not.toContain('Agence requise')
      expect(result.canTransition).toBe(true)
    })

    it('should fail field_equals when value does not match', () => {
      const condition: TransitionCondition = {
        type: 'field_equals',
        field: 'metierId',
        value: 'plomberie',
        message: 'Metier doit etre plomberie',
      }
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B', { conditions: [condition] })],
      )

      const result = validateTransition(workflow, 'A', 'B', {
        fieldX: 'ok',
        metierId: 'electricite',
      })

      expect(result.failedConditions).toContain('Metier doit etre plomberie')
    })

    it('should pass field_equals when value matches', () => {
      const condition: TransitionCondition = {
        type: 'field_equals',
        field: 'metierId',
        value: 'plomberie',
        message: 'Metier doit etre plomberie',
      }
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B', { conditions: [condition] })],
      )

      const result = validateTransition(workflow, 'A', 'B', {
        fieldX: 'ok',
        metierId: 'plomberie',
      })

      expect(result.failedConditions).not.toContain('Metier doit etre plomberie')
      expect(result.canTransition).toBe(true)
    })

    it('should always fail custom_validation conditions (engine has no executor)', () => {
      const condition: TransitionCondition = {
        type: 'custom_validation',
        message: 'Validation custom non implementee',
      }
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B', { conditions: [condition] })],
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result.failedConditions).toContain('Validation custom non implementee')
      expect(result.canTransition).toBe(false)
    })

    it('should treat field_required with missing field key as failing', () => {
      const condition: TransitionCondition = {
        type: 'field_required',
        field: undefined,
        message: 'Champ obligatoire',
      }
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B', { conditions: [condition] })],
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result.failedConditions).toContain('Champ obligatoire')
    })
  })

  describe('validateTransition - VALIDATION_RULES filtering', () => {
    it('should apply rules scoped by from/to that match the current transition', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B')],
      )

      const result = validateTransition(workflow, 'A', 'B', {})

      expect(result.failedConditions).toContain('Champ obligatoire X')
    })

    it('should skip rules scoped by from/to that do not match', () => {
      const workflow = makeWorkflow(
        [makeStatus('B'), makeStatus('C')],
        [makeTransition('B', 'C')],
      )

      const result = validateTransition(workflow, 'B', 'C', { artisanId: 'a-1' })

      expect(result.failedConditions).not.toContain('Champ obligatoire X')
    })

    it('should apply rules scoped by statuses array when target matches', () => {
      const workflow = makeWorkflow(
        [makeStatus('B'), makeStatus('C')],
        [makeTransition('B', 'C')],
      )

      const result = validateTransition(workflow, 'B', 'C', { artisanId: null })

      expect(result.failedConditions).toContain('Doit avoir un artisan')
    })

    it('should deduplicate identical messages from multiple matching rules', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B')],
      )

      // Trigger the same rule twice via cumulative + base. Cumulative returns
      // a rule with the SAME message as the existing 'Champ obligatoire X' rule.
      vi.mocked(getCumulativeEntryRules).mockReturnValue([
        {
          message: 'Champ obligatoire X',
          validate: () => false,
        },
      ] as never)
      mutableChainConfig.validationMode = 'strict'

      const result = validateTransition(workflow, 'A', 'B', {})

      const occurrences = result.failedConditions.filter(
        (msg) => msg === 'Champ obligatoire X',
      )
      expect(occurrences.length).toBe(1)
    })
  })

  describe('validateTransition - cumulative mode toggle', () => {
    it('should NOT call getCumulativeEntryRules in permissive mode', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B')],
      )
      mutableChainConfig.validationMode = 'permissive'

      validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(getCumulativeEntryRules).not.toHaveBeenCalled()
    })

    it('should call getCumulativeEntryRules in strict mode', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B')],
      )
      mutableChainConfig.validationMode = 'strict'

      validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(getCumulativeEntryRules).toHaveBeenCalledWith('B')
    })

    it('should add cumulative failures to failedConditions in strict mode', () => {
      vi.mocked(getCumulativeEntryRules).mockReturnValue([
        {
          message: 'Cumulative requirement missing',
          validate: () => false,
        },
      ] as never)
      mutableChainConfig.validationMode = 'strict'

      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B')],
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result.failedConditions).toContain('Cumulative requirement missing')
      expect(result.canTransition).toBe(false)
    })
  })

  describe('validateTransition - happy path', () => {
    it('should authorize when no missing requirements and no failing conditions', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('A', 'B')],
      )

      const result = validateTransition(workflow, 'A', 'B', { fieldX: 'ok' })

      expect(result).toEqual({
        canTransition: true,
        missingRequirements: [],
        failedConditions: [],
      })
    })
  })

  describe('findAvailableTransitions', () => {
    it('should return all active transitions out of the given status', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B'), makeStatus('C')],
        [
          makeTransition('A', 'B'),
          makeTransition('A', 'C'),
          makeTransition('B', 'C'),
        ],
      )

      const result = findAvailableTransitions(workflow, 'A')

      expect(result).toHaveLength(2)
      expect(result.map((t) => t.toStatusId)).toEqual(
        expect.arrayContaining(['status-B', 'status-C']),
      )
    })

    it('should exclude inactive transitions', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B'), makeStatus('C')],
        [
          makeTransition('A', 'B', { isActive: false }),
          makeTransition('A', 'C'),
        ],
      )

      const result = findAvailableTransitions(workflow, 'A')

      expect(result).toHaveLength(1)
      expect(result[0].toStatusId).toBe('status-C')
    })

    it('should return empty array when source status does not exist', () => {
      const workflow = makeWorkflow(
        [makeStatus('A')],
        [makeTransition('A', 'A')],
      )

      const result = findAvailableTransitions(workflow, 'UNKNOWN')

      expect(result).toEqual([])
    })

    it('should return empty array when no transitions originate from the status', () => {
      const workflow = makeWorkflow(
        [makeStatus('A'), makeStatus('B')],
        [makeTransition('B', 'A')],
      )

      const result = findAvailableTransitions(workflow, 'A')

      expect(result).toEqual([])
    })
  })
})
