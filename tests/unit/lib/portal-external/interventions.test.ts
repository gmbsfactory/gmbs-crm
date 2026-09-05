import { describe, it, expect } from 'vitest'
import {
  PORTAL_ONGOING_STATUSES,
  PORTAL_PRICE_STATUSES,
  PORTAL_REPORT_STATUSES,
  PORTAL_START_STATUSES,
  PORTAL_TENANT_STATUSES,
  PORTAL_VISIBLE_STATUSES,
  isPriceAllowedStatus,
  isReportAllowedStatus,
  isStartAllowedStatus,
  isTenantVisibleStatus,
  pickPortalReport,
} from '@/lib/portal-external/interventions'

describe('pickPortalReport', () => {
  it('should return null without report', () => {
    expect(pickPortalReport([])).toBeNull()
  })

  it('should return the first (most recent) report when none is pending', () => {
    const reports = [{ id: 'b', status: 'approved' }, { id: 'a', status: 'rejected' }]
    expect(pickPortalReport(reports)?.id).toBe('b')
  })

  it('should prefer the submitted report even if an approved one is more recent', () => {
    const reports = [
      { id: 'sofia-v2', status: 'approved' },
      { id: 'karim-v1', status: 'submitted' },
      { id: 'sofia-v1', status: 'rejected' },
    ]
    expect(pickPortalReport(reports)?.id).toBe('karim-v1')
  })

  it('should keep the first submitted report when several are pending', () => {
    const reports = [{ id: 'k', status: 'submitted' }, { id: 's', status: 'submitted' }]
    expect(pickPortalReport(reports)?.id).toBe('k')
  })
})

describe('Constantes de visibilité du portail (spécification §7.1)', () => {
  it('should expose six independent literal lists, never aliases', () => {
    const listes = [
      PORTAL_VISIBLE_STATUSES,
      PORTAL_TENANT_STATUSES,
      PORTAL_REPORT_STATUSES,
      PORTAL_ONGOING_STATUSES,
      PORTAL_PRICE_STATUSES,
      PORTAL_START_STATUSES,
    ]
    // Deux alias partageraient la même référence : c'est exactement le bug
    // d'origine (modifier l'une modifiait silencieusement les trois).
    for (let i = 0; i < listes.length; i += 1) {
      for (let j = i + 1; j < listes.length; j += 1) {
        expect(listes[i]).not.toBe(listes[j])
      }
    }
  })

  it('should never leak the tenant in DEVIS_ENVOYE (RGPD, principe P4)', () => {
    expect(isTenantVisibleStatus('DEVIS_ENVOYE')).toBe(false)
    expect(PORTAL_TENANT_STATUSES).not.toContain('DEVIS_ENVOYE')
  })

  it('should never allow a report in DEVIS_ENVOYE', () => {
    expect(isReportAllowedStatus('DEVIS_ENVOYE')).toBe(false)
  })

  it('should not count DEVIS_ENVOYE as an ongoing mission', () => {
    expect(PORTAL_ONGOING_STATUSES).not.toContain('DEVIS_ENVOYE')
  })

  it('should allow a price response only in DEVIS_ENVOYE', () => {
    expect(isPriceAllowedStatus('DEVIS_ENVOYE')).toBe(true)
    expect(isPriceAllowedStatus('ACCEPTE')).toBe(false)
    expect(isPriceAllowedStatus(null)).toBe(false)
  })

  it('should allow a work start only in ACCEPTE', () => {
    expect(isStartAllowedStatus('ACCEPTE')).toBe(true)
    expect(isStartAllowedStatus('DEVIS_ENVOYE')).toBe(false)
    expect(isStartAllowedStatus('INTER_EN_COURS')).toBe(false)
  })
})
