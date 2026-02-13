import { describe, it, expect } from 'vitest'
import {
  normalizeColumnStyle,
  STYLE_ELIGIBLE_COLUMNS,
  TABLE_TEXT_SIZE_VALUES,
} from '@/lib/interventions/column-style'

describe('interventions/column-style', () => {
  describe('constants', () => {
    it('should have expected eligible columns', () => {
      expect(STYLE_ELIGIBLE_COLUMNS.has('statusValue')).toBe(true)
      expect(STYLE_ELIGIBLE_COLUMNS.has('attribueA')).toBe(true)
      expect(STYLE_ELIGIBLE_COLUMNS.has('agence')).toBe(true)
      expect(STYLE_ELIGIBLE_COLUMNS.has('metier')).toBe(true)
    })

    it('should have expected text size values', () => {
      expect(TABLE_TEXT_SIZE_VALUES).toEqual(['xl', 'lg', 'md', 'sm', 'xs'])
    })
  })

  describe('normalizeColumnStyle', () => {
    it('should return undefined for undefined style', () => {
      expect(normalizeColumnStyle('statusValue', undefined)).toBeUndefined()
    })

    it('should return undefined for empty style', () => {
      expect(normalizeColumnStyle('statusValue', {})).toBeUndefined()
    })

    it('should preserve appearance for eligible columns', () => {
      const result = normalizeColumnStyle('statusValue', { appearance: 'badge' })
      expect(result?.appearance).toBe('badge')
    })

    it('should not include appearance for non-eligible columns', () => {
      const result = normalizeColumnStyle('someOtherColumn', { appearance: 'badge', bold: true })
      expect(result?.appearance).toBeUndefined()
      expect(result?.bold).toBe(true)
    })

    it('should not include default text size (md)', () => {
      const result = normalizeColumnStyle('statusValue', { textSize: 'md', appearance: 'solid' })
      expect(result?.textSize).toBeUndefined()
    })

    it('should include non-default text size', () => {
      const result = normalizeColumnStyle('statusValue', { textSize: 'lg', appearance: 'solid' })
      expect(result?.textSize).toBe('lg')
    })

    it('should preserve bold', () => {
      const result = normalizeColumnStyle('col', { bold: true })
      expect(result?.bold).toBe(true)
    })

    it('should preserve italic', () => {
      const result = normalizeColumnStyle('col', { italic: true })
      expect(result?.italic).toBe(true)
    })

    it('should preserve textColor', () => {
      const result = normalizeColumnStyle('col', { textColor: '#ff0000' })
      expect(result?.textColor).toBe('#ff0000')
    })

    it('should not include falsy bold/italic', () => {
      const result = normalizeColumnStyle('col', { bold: false, italic: false, textColor: '#fff' })
      expect(result?.bold).toBeUndefined()
      expect(result?.italic).toBeUndefined()
      expect(result?.textColor).toBe('#fff')
    })
  })
})
