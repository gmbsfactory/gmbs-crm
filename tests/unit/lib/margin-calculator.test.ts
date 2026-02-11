import { describe, it, expect } from 'vitest'
import {
  calculatePrimaryArtisanMargin,
  calculateSecondaryArtisanMargin,
  formatMarginPercentage,
  getMarginColorClass,
} from '@/lib/utils/margin-calculator'

describe('margin-calculator', () => {
  describe('calculatePrimaryArtisanMargin', () => {
    it('should calculate margin correctly', () => {
      const result = calculatePrimaryArtisanMargin(1000, 600, 100)
      expect(result.marginPercentage).toBe(30)
      expect(result.marginValue).toBe(300)
      expect(result.revenue).toBe(1000)
      expect(result.totalCosts).toBe(700)
      expect(result.isValid).toBe(true)
    })

    it('should handle string inputs', () => {
      const result = calculatePrimaryArtisanMargin('1000', '600', '100')
      expect(result.marginPercentage).toBe(30)
      expect(result.isValid).toBe(true)
    })

    it('should return invalid for zero revenue', () => {
      const result = calculatePrimaryArtisanMargin(0, 100, 50)
      expect(result.isValid).toBe(false)
      expect(result.marginPercentage).toBe(0)
      expect(result.marginValue).toBe(0)
    })

    it('should return invalid for negative revenue', () => {
      const result = calculatePrimaryArtisanMargin(-100, 50, 50)
      expect(result.isValid).toBe(false)
    })

    it('should handle negative margin', () => {
      const result = calculatePrimaryArtisanMargin(100, 80, 50)
      expect(result.marginPercentage).toBeLessThan(0)
      expect(result.marginValue).toBeLessThan(0)
      expect(result.isValid).toBe(true)
    })

    it('should handle NaN inputs as 0', () => {
      const result = calculatePrimaryArtisanMargin('invalid', 'bad', 'data')
      expect(result.isValid).toBe(false)
      expect(result.revenue).toBe(0)
    })

    it('should handle 100% margin (no costs)', () => {
      const result = calculatePrimaryArtisanMargin(1000, 0, 0)
      expect(result.marginPercentage).toBe(100)
      expect(result.marginValue).toBe(1000)
    })
  })

  describe('calculateSecondaryArtisanMargin', () => {
    it('should calculate secondary margin correctly', () => {
      const result = calculateSecondaryArtisanMargin(1000, 400, 100, 300, 50)
      expect(result.revenue).toBe(500) // 1000 - (400 + 100)
      expect(result.totalCosts).toBe(350) // 300 + 50
      expect(result.marginValue).toBe(150) // 500 - 350
      expect(result.marginPercentage).toBe(30) // (150 / 500) * 100
      expect(result.isValid).toBe(true)
    })

    it('should return invalid when available revenue is zero', () => {
      const result = calculateSecondaryArtisanMargin(500, 400, 100, 0, 0)
      expect(result.isValid).toBe(false)
      expect(result.revenue).toBe(0)
    })

    it('should return invalid when available revenue is negative', () => {
      const result = calculateSecondaryArtisanMargin(500, 400, 200, 0, 0)
      expect(result.isValid).toBe(false)
    })

    it('should handle string inputs', () => {
      const result = calculateSecondaryArtisanMargin('1000', '400', '100', '300', '50')
      expect(result.marginPercentage).toBe(30)
    })
  })

  describe('formatMarginPercentage', () => {
    it('should format with default 1 decimal', () => {
      expect(formatMarginPercentage(30.567)).toBe('30.6 %')
    })

    it('should format with custom decimals', () => {
      expect(formatMarginPercentage(30.567, 2)).toBe('30.57 %')
    })

    it('should format negative margin', () => {
      expect(formatMarginPercentage(-15.3)).toBe('-15.3 %')
    })

    it('should format zero', () => {
      expect(formatMarginPercentage(0)).toBe('0.0 %')
    })
  })

  describe('getMarginColorClass', () => {
    it('should return destructive for negative margin', () => {
      expect(getMarginColorClass(-5)).toBe('text-destructive')
    })

    it('should return green for positive margin', () => {
      expect(getMarginColorClass(30)).toBe('text-green-600')
    })

    it('should return green for zero margin', () => {
      expect(getMarginColorClass(0)).toBe('text-green-600')
    })
  })
})
