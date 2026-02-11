import { describe, it, expect } from 'vitest'
import {
  METIER_COLORS,
  METIER_COLORS_BY_LABEL,
  getMetierColor,
} from '@/config/metier-colors'

describe('metier-colors', () => {
  describe('METIER_COLORS', () => {
    it('should have color for PLOMBERIE', () => {
      expect(METIER_COLORS['PLOMBERIE']).toBe('#3B82F6')
    })

    it('should have color for ELECTRICITE', () => {
      expect(METIER_COLORS['ELECTRICITE']).toBe('#F59E0B')
    })

    it('should have color for AUTRES', () => {
      expect(METIER_COLORS['AUTRES']).toBe('#6B7280')
    })
  })

  describe('METIER_COLORS_BY_LABEL', () => {
    it('should have color for Plomberie', () => {
      expect(METIER_COLORS_BY_LABEL['Plomberie']).toBe('#3B82F6')
    })

    it('should have color for Électricité', () => {
      expect(METIER_COLORS_BY_LABEL['Électricité']).toBe('#F59E0B')
    })
  })

  describe('getMetierColor', () => {
    it('should return color by code', () => {
      expect(getMetierColor('PLOMBERIE')).toBe('#3B82F6')
    })

    it('should return color by label when code not found', () => {
      expect(getMetierColor(null, 'Plomberie')).toBe('#3B82F6')
    })

    it('should prefer code over label', () => {
      expect(getMetierColor('ELECTRICITE', 'Plomberie')).toBe('#F59E0B')
    })

    it('should fallback to uppercase label lookup', () => {
      expect(getMetierColor(null, 'plomberie')).toBe('#3B82F6')
    })

    it('should return default when not found', () => {
      expect(getMetierColor('UNKNOWN', 'Unknown')).toBe('#6366F1')
    })

    it('should return default when both null', () => {
      expect(getMetierColor(null, null)).toBe('#6366F1')
    })

    it('should return default when no args', () => {
      expect(getMetierColor()).toBe('#6366F1')
    })

    it('should handle accented label via uppercase fallback', () => {
      // "Électricité" uppercased is "ÉLECTRICITÉ" which is NOT in METIER_COLORS (key is ELECTRICITE)
      // So it falls back to default
      expect(getMetierColor(null, 'électricité')).toBe('#6366F1')
    })

    it('should return color for Rénovation label', () => {
      expect(getMetierColor(null, 'Rénovation')).toBe('#C084FC')
    })

    it('should return color for RENOVATION code', () => {
      expect(getMetierColor('RENOVATION')).toBe('#C084FC')
    })
  })
})
