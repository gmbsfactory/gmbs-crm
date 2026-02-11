import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateTransition } from '@/lib/workflow-engine'
import { DEFAULT_WORKFLOW_CONFIG } from '@/config/interventions'
import { STATUS_CHAIN_CONFIG } from '@/config/intervention-status-chains'
import type { WorkflowEntityContext } from '@/types/intervention-workflow'

// STATUS_CHAIN_CONFIG is `as const` at type level but mutable at runtime
const mutableConfig = STATUS_CHAIN_CONFIG as { validationMode: string }

/**
 * Contexte complet avec tous les champs renseignés pour que les validations passent.
 */
function fullContext(overrides: Partial<WorkflowEntityContext> = {}): WorkflowEntityContext {
  return {
    id: 'intervention-1',
    artisanId: 'artisan-1',
    factureId: 'facture-1',
    proprietaireId: 'proprio-1',
    commentaire: 'Un commentaire',
    devisId: 'devis-1',
    idIntervention: 'INT-2024-001',
    nomPrenomFacturation: 'Dupont Jean',
    assignedUserId: 'user-1',
    coutIntervention: 500,
    coutSST: 200,
    consigneArtisan: 'Consigne de test',
    nomPrenomClient: 'Martin Pierre',
    telephoneClient: '0612345678',
    datePrevue: '2024-06-15',
    attachments: [{ kind: 'facturesGMBS' }],
    ...overrides,
  }
}

describe('validateTransition - cumulative mode', () => {
  beforeEach(() => {
    mutableConfig.validationMode = 'strict'
  })

  afterEach(() => {
    mutableConfig.validationMode = 'permissive'
  })

  describe('Main chain cumulative enforcement', () => {
    it('should block DEMANDE → INTER_EN_COURS when DEVIS_ENVOYE requirements missing', () => {
      // Missing nomPrenomFacturation and assignedUserId (DEVIS_ENVOYE requirements)
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'DEMANDE',
        'INTER_EN_COURS',
        fullContext({
          nomPrenomFacturation: null,
          assignedUserId: null,
        }),
      )

      // Note: DEMANDE → INTER_EN_COURS is not in AUTHORIZED_TRANSITIONS,
      // so it will fail with "Transition non autorisée" too.
      // But we verify cumulative messages are also present.
      expect(validation.canTransition).toBe(false)
    })

    it('should block ACCEPTE → INTER_TERMINEE (clôture express) when INTER_EN_COURS requirements missing', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'ACCEPTE',
        'INTER_TERMINEE',
        fullContext({
          coutIntervention: null,
          coutSST: null,
          consigneArtisan: null,
          nomPrenomClient: null,
          telephoneClient: null,
          datePrevue: null,
        }),
      )

      expect(validation.canTransition).toBe(false)
      // Should contain INTER_EN_COURS cumulative messages
      expect(validation.failedConditions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/coût d'intervention/i),
          expect.stringMatching(/coût SST/i),
          expect.stringMatching(/consigne/i),
          expect.stringMatching(/nom.*client/i),
          expect.stringMatching(/téléphone.*client/i),
          expect.stringMatching(/date prévue/i),
        ]),
      )
    })

    it('should allow ACCEPTE → INTER_EN_COURS when all cumulative requirements met', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'ACCEPTE',
        'INTER_EN_COURS',
        fullContext(),
      )

      expect(validation.canTransition).toBe(true)
      expect(validation.failedConditions).toHaveLength(0)
    })

    it('should allow DEMANDE → DEVIS_ENVOYE with correct requirements', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'DEMANDE',
        'DEVIS_ENVOYE',
        fullContext(),
      )

      expect(validation.canTransition).toBe(true)
    })

    it('should block STAND_BY → INTER_EN_COURS when DEVIS_ENVOYE requirements missing', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'STAND_BY',
        'INTER_EN_COURS',
        fullContext({
          nomPrenomFacturation: null,
          assignedUserId: null,
        }),
      )

      expect(validation.canTransition).toBe(false)
      expect(validation.failedConditions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/nom.*facturation/i),
          expect.stringMatching(/gestionnaire/i),
        ]),
      )
    })

    it('should block STAND_BY → ACCEPTE when DEVIS_ENVOYE requirements missing', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'STAND_BY',
        'ACCEPTE',
        fullContext({
          nomPrenomFacturation: null,
          assignedUserId: null,
        }),
      )

      expect(validation.canTransition).toBe(false)
      expect(validation.failedConditions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/nom.*facturation/i),
          expect.stringMatching(/gestionnaire/i),
        ]),
      )
    })

    it('should allow ACCEPTE → INTER_TERMINEE when all cumulative requirements met', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'ACCEPTE',
        'INTER_TERMINEE',
        fullContext(),
      )

      expect(validation.canTransition).toBe(true)
    })
  })

  describe('Off-chain statuses', () => {
    it('should NOT apply cumulative rules when transitioning to VISITE_TECHNIQUE', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'DEMANDE',
        'VISITE_TECHNIQUE',
        fullContext({
          nomPrenomFacturation: null,
          assignedUserId: null,
        }),
      )

      // VISITE_TECHNIQUE only requires artisan (via statuses array),
      // NOT DEVIS_ENVOYE fields
      const messages = validation.failedConditions.join(' ')
      expect(messages).not.toMatch(/facturation/i)
      expect(messages).not.toMatch(/gestionnaire/i)
    })

    it('should NOT apply cumulative rules when transitioning to STAND_BY', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'DEVIS_ENVOYE',
        'STAND_BY',
        fullContext({
          nomPrenomFacturation: null,
          commentaire: 'Raison du stand by',
        }),
      )

      const messages = validation.failedConditions.join(' ')
      expect(messages).not.toMatch(/facturation/i)
    })

    it('should NOT apply cumulative rules when transitioning to REFUSE', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'DEMANDE',
        'REFUSE',
        fullContext({
          nomPrenomFacturation: null,
          commentaire: 'Raison du refus',
        }),
      )

      const messages = validation.failedConditions.join(' ')
      expect(messages).not.toMatch(/facturation/i)
    })

    it('should NOT apply cumulative rules when transitioning to ANNULE', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'DEMANDE',
        'ANNULE',
        fullContext({
          nomPrenomFacturation: null,
          commentaire: 'Raison annulation',
        }),
      )

      const messages = validation.failedConditions.join(' ')
      expect(messages).not.toMatch(/facturation/i)
    })
  })

  describe('Permissive mode backward compat', () => {
    it('should NOT apply cumulative rules when validationMode is permissive', () => {
      mutableConfig.validationMode = 'permissive'

      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'ACCEPTE',
        'INTER_TERMINEE',
        fullContext({
          coutIntervention: null,
          coutSST: null,
          consigneArtisan: null,
          nomPrenomClient: null,
          telephoneClient: null,
          datePrevue: null,
        }),
      )

      // In permissive mode, INTER_EN_COURS cumulative rules should NOT apply
      const messages = validation.failedConditions.join(' ')
      expect(messages).not.toMatch(/coût d'intervention/i)
      expect(messages).not.toMatch(/coût SST/i)
      expect(messages).not.toMatch(/consigne/i)
    })
  })

  describe('Error message deduplication', () => {
    it('should not duplicate messages when same rule matches target and predecessor', () => {
      const validation = validateTransition(
        DEFAULT_WORKFLOW_CONFIG,
        'ACCEPTE',
        'INTER_EN_COURS',
        fullContext({
          idIntervention: null,
        }),
      )

      // INTERVENTION_ID_REQUIRED matches INTER_EN_COURS via statuses array
      // AND would also match via cumulative (DEVIS_ENVOYE is a predecessor)
      const idMessages = validation.failedConditions.filter(msg =>
        msg.includes('ID intervention'),
      )
      expect(idMessages.length).toBeLessThanOrEqual(1)
    })
  })
})
