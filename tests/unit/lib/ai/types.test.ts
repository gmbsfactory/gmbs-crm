import { describe, it, expect } from 'vitest'
import type {
  AIActionButtonType,
  AIActionPayload,
  AISuggestedAction,
} from '@/lib/ai/types'

describe('AI Types', () => {
  describe('AIActionButtonType', () => {
    it('should accept valid action button types', () => {
      const types: AIActionButtonType[] = [
        'change_status',
        'assign_artisan',
        'navigate_section',
        'send_email',
        'add_comment',
      ]
      expect(types).toHaveLength(5)
    })
  })

  describe('AIActionPayload', () => {
    it('should create a valid change_status payload', () => {
      const payload: AIActionPayload = {
        type: 'change_status',
        target_status_code: 'ACCEPTE',
        target_status_label: 'Accepté',
        requires_comment: false,
      }
      expect(payload.type).toBe('change_status')
      expect(payload.target_status_code).toBe('ACCEPTE')
    })

    it('should create a valid assign_artisan payload', () => {
      const payload: AIActionPayload = {
        type: 'assign_artisan',
        metier_code: 'PLOMBERIE',
        code_postal: '75001',
      }
      expect(payload.type).toBe('assign_artisan')
      expect(payload.metier_code).toBe('PLOMBERIE')
    })

    it('should create a valid navigate_section payload', () => {
      const payload: AIActionPayload = {
        type: 'navigate_section',
        section: 'comments',
      }
      expect(payload.type).toBe('navigate_section')
      expect(payload.section).toBe('comments')
    })

    it('should create a valid send_email payload', () => {
      const payload: AIActionPayload = {
        type: 'send_email',
        email_type: 'client',
      }
      expect(payload.type).toBe('send_email')
      expect(payload.email_type).toBe('client')
    })

    it('should create a valid add_comment payload', () => {
      const payload: AIActionPayload = {
        type: 'add_comment',
      }
      expect(payload.type).toBe('add_comment')
    })
  })

  describe('AISuggestedAction', () => {
    it('should create a complete suggested action with all fields', () => {
      const action: AISuggestedAction = {
        id: 'action-0',
        label: 'Envoyer devis',
        description: 'Passer au statut "Devis envoyé"',
        action_type: 'change_status',
        payload: {
          type: 'change_status',
          target_status_code: 'DEVIS_ENVOYE',
          target_status_label: 'Devis envoyé',
          requires_comment: false,
        },
        priority: 'high',
        icon: 'arrow-right',
        status_color: '#8B5CF6',
      }
      expect(action.id).toBe('action-0')
      expect(action.priority).toBe('high')
      expect(action.action_type).toBe('change_status')
      expect(action.status_color).toBe('#8B5CF6')
    })

    it('should support disabled state with reason', () => {
      const action: AISuggestedAction = {
        id: 'action-1',
        label: 'Assigner artisan',
        description: 'Rechercher et assigner un artisan',
        action_type: 'assign_artisan',
        payload: { type: 'assign_artisan' },
        priority: 'high',
        disabled: true,
        disabled_reason: 'Un artisan est deja assigne',
      }
      expect(action.disabled).toBe(true)
      expect(action.disabled_reason).toBe('Un artisan est deja assigne')
    })

    it('should accept all priority levels', () => {
      const priorities: AISuggestedAction['priority'][] = ['high', 'medium', 'low']
      expect(priorities).toHaveLength(3)
    })
  })
})
