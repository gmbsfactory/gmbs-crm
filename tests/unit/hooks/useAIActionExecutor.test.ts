import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AI_EVENTS } from '@/hooks/useAIActionExecutor'
import type { AISuggestedAction } from '@/lib/ai/types'

// Test the AI_EVENTS constants and custom event dispatch pattern
describe('useAIActionExecutor', () => {
  describe('AI_EVENTS constants', () => {
    it('should define all required event names', () => {
      expect(AI_EVENTS.OPEN_ARTISAN_SEARCH).toBe('ai:open-artisan-search')
      expect(AI_EVENTS.NAVIGATE_SECTION).toBe('ai:navigate-section')
      expect(AI_EVENTS.FOCUS_COMMENT).toBe('ai:focus-comment')
      expect(AI_EVENTS.OPEN_EMAIL_MODAL).toBe('ai:open-email-modal')
      expect(AI_EVENTS.CHANGE_STATUS).toBe('ai:change-status')
    })
  })

  describe('Custom event dispatch pattern', () => {
    let eventHandler: ReturnType<typeof vi.fn>

    beforeEach(() => {
      eventHandler = vi.fn()
    })

    afterEach(() => {
      window.removeEventListener(AI_EVENTS.OPEN_ARTISAN_SEARCH, eventHandler)
      window.removeEventListener(AI_EVENTS.NAVIGATE_SECTION, eventHandler)
      window.removeEventListener(AI_EVENTS.FOCUS_COMMENT, eventHandler)
      window.removeEventListener(AI_EVENTS.OPEN_EMAIL_MODAL, eventHandler)
      window.removeEventListener(AI_EVENTS.CHANGE_STATUS, eventHandler)
    })

    it('should dispatch ai:open-artisan-search event with correct detail', () => {
      window.addEventListener(AI_EVENTS.OPEN_ARTISAN_SEARCH, eventHandler)

      const detail = { interventionId: 'test-id', metierCode: 'PLOMBERIE', codePostal: '75001' }
      window.dispatchEvent(new CustomEvent(AI_EVENTS.OPEN_ARTISAN_SEARCH, { detail }))

      expect(eventHandler).toHaveBeenCalledTimes(1)
      const event = eventHandler.mock.calls[0][0] as CustomEvent
      expect(event.detail.interventionId).toBe('test-id')
      expect(event.detail.metierCode).toBe('PLOMBERIE')
    })

    it('should dispatch ai:navigate-section event with section info', () => {
      window.addEventListener(AI_EVENTS.NAVIGATE_SECTION, eventHandler)

      const detail = { interventionId: 'test-id', section: 'comments' }
      window.dispatchEvent(new CustomEvent(AI_EVENTS.NAVIGATE_SECTION, { detail }))

      expect(eventHandler).toHaveBeenCalledTimes(1)
      const event = eventHandler.mock.calls[0][0] as CustomEvent
      expect(event.detail.section).toBe('comments')
    })

    it('should dispatch ai:focus-comment event', () => {
      window.addEventListener(AI_EVENTS.FOCUS_COMMENT, eventHandler)

      const detail = { interventionId: 'test-id' }
      window.dispatchEvent(new CustomEvent(AI_EVENTS.FOCUS_COMMENT, { detail }))

      expect(eventHandler).toHaveBeenCalledTimes(1)
    })

    it('should dispatch ai:open-email-modal event with email type', () => {
      window.addEventListener(AI_EVENTS.OPEN_EMAIL_MODAL, eventHandler)

      const detail = { interventionId: 'test-id', emailType: 'client' }
      window.dispatchEvent(new CustomEvent(AI_EVENTS.OPEN_EMAIL_MODAL, { detail }))

      expect(eventHandler).toHaveBeenCalledTimes(1)
      const event = eventHandler.mock.calls[0][0] as CustomEvent
      expect(event.detail.emailType).toBe('client')
    })

    it('should dispatch ai:change-status event with status details', () => {
      window.addEventListener(AI_EVENTS.CHANGE_STATUS, eventHandler)

      const detail = {
        interventionId: 'test-id',
        statusId: 'status-uuid',
        statusCode: 'ACCEPTE',
        statusLabel: 'Accepté',
        requiresComment: true,
      }
      window.dispatchEvent(new CustomEvent(AI_EVENTS.CHANGE_STATUS, { detail }))

      expect(eventHandler).toHaveBeenCalledTimes(1)
      const event = eventHandler.mock.calls[0][0] as CustomEvent
      expect(event.detail.statusCode).toBe('ACCEPTE')
      expect(event.detail.requiresComment).toBe(true)
    })
  })

  describe('Action type mapping', () => {
    it('should map change_status action to CHANGE_STATUS event', () => {
      const action: AISuggestedAction = {
        id: 'action-0',
        label: 'Accepter devis',
        description: 'Passer au statut "Accepté"',
        action_type: 'change_status',
        payload: {
          type: 'change_status',
          target_status_code: 'ACCEPTE',
          target_status_label: 'Accepté',
          requires_comment: false,
        },
        priority: 'high',
      }
      expect(action.payload.type).toBe('change_status')
      expect(action.action_type).toBe('change_status')
    })

    it('should map assign_artisan action to OPEN_ARTISAN_SEARCH event', () => {
      const action: AISuggestedAction = {
        id: 'action-1',
        label: 'Assigner artisan',
        description: 'Rechercher un artisan',
        action_type: 'assign_artisan',
        payload: { type: 'assign_artisan', metier_code: 'PLOMBERIE' },
        priority: 'high',
      }
      expect(action.payload.type).toBe('assign_artisan')
    })

    it('should map send_email action to OPEN_EMAIL_MODAL event', () => {
      const action: AISuggestedAction = {
        id: 'action-2',
        label: 'Email client',
        description: 'Envoyer un email',
        action_type: 'send_email',
        payload: { type: 'send_email', email_type: 'client' },
        priority: 'medium',
      }
      expect(action.payload.type).toBe('send_email')
    })
  })
})
