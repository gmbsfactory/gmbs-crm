import { describe, it, expect } from 'vitest'
import {
  isDepositReceived,
  isSSTDepositReceived,
  isClientDepositReceived,
  hasAnyDepositReceived,
  getStatusDisplayLabel,
} from '@/lib/interventions/deposit-helpers'

const createPayment = (overrides: Record<string, any> = {}) => ({
  is_received: true,
  payment_date: '2024-01-15',
  payment_type: 'acompte_sst',
  amount: 500,
  ...overrides,
})

describe('interventions/deposit-helpers', () => {
  describe('isDepositReceived', () => {
    it('should return true for received deposit with date', () => {
      expect(isDepositReceived(createPayment())).toBe(true)
    })

    it('should return false when not received', () => {
      expect(isDepositReceived(createPayment({ is_received: false }))).toBe(false)
    })

    it('should return false when no payment date', () => {
      expect(isDepositReceived(createPayment({ payment_date: null }))).toBe(false)
    })

    it('should return false for undefined payment', () => {
      expect(isDepositReceived(undefined)).toBe(false)
    })
  })

  describe('isSSTDepositReceived', () => {
    it('should return true for SST payment', () => {
      expect(isSSTDepositReceived(createPayment({ payment_type: 'acompte_sst' }))).toBe(true)
    })

    it('should return false for client payment', () => {
      expect(isSSTDepositReceived(createPayment({ payment_type: 'acompte_client' }))).toBe(false)
    })
  })

  describe('isClientDepositReceived', () => {
    it('should return true for client payment', () => {
      expect(isClientDepositReceived(createPayment({ payment_type: 'acompte_client' }))).toBe(true)
    })

    it('should return false for SST payment', () => {
      expect(isClientDepositReceived(createPayment({ payment_type: 'acompte_sst' }))).toBe(false)
    })
  })

  describe('hasAnyDepositReceived', () => {
    it('should return true when SST deposit received', () => {
      expect(hasAnyDepositReceived(createPayment({ payment_type: 'acompte_sst' }), undefined)).toBe(true)
    })

    it('should return true when client deposit received', () => {
      expect(hasAnyDepositReceived(undefined, createPayment({ payment_type: 'acompte_client' }))).toBe(true)
    })

    it('should return false when no deposits received', () => {
      expect(hasAnyDepositReceived(undefined, undefined)).toBe(false)
    })
  })

  describe('getStatusDisplayLabel', () => {
    it('should append $ for ACCEPTE with deposit received', () => {
      const result = getStatusDisplayLabel(
        'ACCEPTE',
        'Accepté',
        createPayment({ payment_type: 'acompte_sst' }),
        undefined,
      )
      expect(result).toBe('Accepté $')
    })

    it('should return plain label for ACCEPTE without deposit', () => {
      expect(getStatusDisplayLabel('ACCEPTE', 'Accepté', undefined, undefined)).toBe('Accepté')
    })

    it('should return plain label for non-ACCEPTE status', () => {
      expect(getStatusDisplayLabel(
        'DEMANDE',
        'Demandé',
        createPayment({ payment_type: 'acompte_sst' }),
        undefined,
      )).toBe('Demandé')
    })

    it('should return plain label when status undefined', () => {
      expect(getStatusDisplayLabel(undefined, 'Unknown')).toBe('Unknown')
    })
  })
})
