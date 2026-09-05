import { describe, it, expect } from 'vitest'
import {
  PAYMENT_STATUSES,
  describePaymentStatus,
  isPaymentStatus,
} from '@/lib/interventions/payment-status'

describe('payment-status', () => {
  describe('PAYMENT_STATUSES', () => {
    it('should list exactly the six values of the CHECK of 99078 then 99085', () => {
      expect([...PAYMENT_STATUSES]).toEqual([
        'not_applicable',
        'awaiting_invoice',
        'invoice_received',
        'in_progress',
        'paid',
        'disputed',
      ])
    })
  })

  describe('isPaymentStatus', () => {
    it('should accept the six known values', () => {
      for (const state of PAYMENT_STATUSES) expect(isPaymentStatus(state)).toBe(true)
    })

    it('should reject anything else', () => {
      expect(isPaymentStatus('rembourse')).toBe(false)
      expect(isPaymentStatus(null)).toBe(false)
      expect(isPaymentStatus(undefined)).toBe(false)
      expect(isPaymentStatus(3)).toBe(false)
    })
  })

  describe('describePaymentStatus', () => {
    it('should show nothing for not_applicable', () => {
      expect(describePaymentStatus('not_applicable')).toEqual({
        state: 'not_applicable',
        label: null,
        tone: 'neutral',
      })
    })

    it('should warn the artisan that his invoice is expected', () => {
      expect(describePaymentStatus('awaiting_invoice')).toEqual({
        state: 'awaiting_invoice',
        label: 'En attente de votre facture',
        tone: 'warning',
      })
    })

    it('should announce a payment in progress', () => {
      expect(describePaymentStatus('in_progress')).toEqual({
        state: 'in_progress',
        label: 'Paiement en cours',
        tone: 'info',
      })
    })

    it('should date the payment when paid_at is known', () => {
      expect(describePaymentStatus('paid', '2026-09-20T10:00:00.000Z')).toEqual({
        state: 'paid',
        label: 'Payé le 20/09',
        tone: 'success',
      })
    })

    it('should stay readable when paid_at is missing or unusable', () => {
      expect(describePaymentStatus('paid').label).toBe('Payé')
      expect(describePaymentStatus('paid', 'pas-une-date').label).toBe('Payé')
    })

    it('should tell the artisan his invoice has been received (lot L6)', () => {
      // Sans cet état, un artisan qui vient d'envoyer sa facture continue de
      // lire « en attente de votre facture » — et il rappelle le gestionnaire.
      expect(describePaymentStatus('invoice_received')).toEqual({
        state: 'invoice_received',
        label: 'Facture reçue',
        tone: 'info',
      })
    })

    it('should say a payment is disputed rather than in progress (lot L6)', () => {
      expect(describePaymentStatus('disputed')).toEqual({
        state: 'disputed',
        label: 'En litige',
        tone: 'danger',
      })
    })

    it('should fall back to not_applicable rather than display a wrong label', () => {
      // Un état ajouté en base sans être ajouté ici ne doit jamais produire un
      // libellé faux chez l'artisan : il ne produit rien.
      expect(describePaymentStatus('rembourse')).toEqual({
        state: 'not_applicable',
        label: null,
        tone: 'neutral',
      })
    })
  })
})
