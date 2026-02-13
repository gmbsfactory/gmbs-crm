import { describe, it, expect } from 'vitest'
import {
  INTERVENTION_STATUS_COLORS,
  INTERVENTION_STATUS_COLORS_BY_CODE,
  ARTISAN_STATUS_COLORS,
  ARTISAN_STATUS_COLORS_BY_CODE,
  ARTISAN_STATUS_STYLES,
  getInterventionStatusColor,
  getArtisanStatusColor,
  getArtisanStatusStyles,
} from '@/config/status-colors'

describe('status-colors', () => {
  describe('INTERVENTION_STATUS_COLORS', () => {
    it('should have color for Demandé', () => {
      expect(INTERVENTION_STATUS_COLORS['Demandé']).toBe('#3B82F6')
    })

    it('should have color for Annulé', () => {
      expect(INTERVENTION_STATUS_COLORS['Annulé']).toBe('#EF4444')
    })
  })

  describe('INTERVENTION_STATUS_COLORS_BY_CODE', () => {
    it('should have color for DEMANDE', () => {
      expect(INTERVENTION_STATUS_COLORS_BY_CODE['DEMANDE']).toBe('#3B82F6')
    })

    it('should have color for SAV', () => {
      expect(INTERVENTION_STATUS_COLORS_BY_CODE['SAV']).toBe('#EC4899')
    })
  })

  describe('ARTISAN_STATUS_COLORS', () => {
    it('should have color for Expert', () => {
      expect(ARTISAN_STATUS_COLORS['Expert']).toBe('#6366F1')
    })

    it('should have color for Confirmé', () => {
      expect(ARTISAN_STATUS_COLORS['Confirmé']).toBe('#22C55E')
    })
  })

  describe('getInterventionStatusColor', () => {
    it('should return color by label', () => {
      expect(getInterventionStatusColor('Demandé')).toBe('#3B82F6')
    })

    it('should return color by code when label not found', () => {
      expect(getInterventionStatusColor('Unknown', 'DEMANDE')).toBe('#3B82F6')
    })

    it('should return default color when neither found', () => {
      expect(getInterventionStatusColor('Unknown', 'UNKNOWN')).toBe('#6366F1')
    })

    it('should return default when both null', () => {
      expect(getInterventionStatusColor(null, null)).toBe('#6366F1')
    })

    it('should return default when no args', () => {
      expect(getInterventionStatusColor()).toBe('#6366F1')
    })

    it('should prefer label over code', () => {
      expect(getInterventionStatusColor('Demandé', 'SAV')).toBe('#3B82F6')
    })
  })

  describe('getArtisanStatusColor', () => {
    it('should return color by label', () => {
      expect(getArtisanStatusColor('Expert')).toBe('#6366F1')
    })

    it('should return color by code when label not found', () => {
      expect(getArtisanStatusColor('Unknown', 'EXPERT')).toBe('#6366F1')
    })

    it('should return default when not found', () => {
      expect(getArtisanStatusColor('Unknown', 'UNKNOWN')).toBe('#6366F1')
    })

    it('should return default when null', () => {
      expect(getArtisanStatusColor(null, null)).toBe('#6366F1')
    })
  })

  describe('getArtisanStatusStyles', () => {
    it('should return styles for Expert', () => {
      const styles = getArtisanStatusStyles('Expert')
      expect(styles.bg).toContain('indigo')
      expect(styles.text).toContain('indigo')
      expect(styles.border).toContain('indigo')
      expect(styles.hover).toContain('indigo')
    })

    it('should return styles for Confirmé', () => {
      const styles = getArtisanStatusStyles('Confirmé')
      expect(styles.bg).toContain('green')
    })

    it('should return default styles for unknown label', () => {
      const styles = getArtisanStatusStyles('Unknown')
      expect(styles.bg).toBe('bg-card')
      expect(styles.text).toBe('text-foreground')
      expect(styles.border).toBe('border-border')
      expect(styles.hover).toBe('hover:bg-muted/50')
    })

    it('should return default styles for null', () => {
      const styles = getArtisanStatusStyles(null)
      expect(styles.bg).toBe('bg-card')
    })

    it('should return default styles for undefined', () => {
      const styles = getArtisanStatusStyles()
      expect(styles.bg).toBe('bg-card')
    })
  })
})
