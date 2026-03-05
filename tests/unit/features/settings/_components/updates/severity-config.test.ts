import { describe, it, expect } from 'vitest'
import {
  getSeverityConfig,
  ALL_SEVERITIES,
} from '@/features/settings/_components/updates/severity-config'
import type { AppUpdateSeverity } from '@/types/app-updates'

describe('severity-config', () => {
  describe('ALL_SEVERITIES', () => {
    it('should contain exactly 5 severities', () => {
      expect(ALL_SEVERITIES).toHaveLength(5)
    })

    it('should contain all expected values', () => {
      expect(ALL_SEVERITIES).toEqual(['info', 'important', 'breaking', 'feature', 'fix'])
    })
  })

  describe('getSeverityConfig', () => {
    it('should return config for info', () => {
      const config = getSeverityConfig('info')
      expect(config.label).toBe('Info')
      expect(config.color).toContain('blue')
      expect(config.icon).toBeDefined()
    })

    it('should return config for important', () => {
      const config = getSeverityConfig('important')
      expect(config.label).toBe('Important')
      expect(config.color).toContain('amber')
      expect(config.icon).toBeDefined()
    })

    it('should return config for breaking', () => {
      const config = getSeverityConfig('breaking')
      expect(config.label).toBe('Breaking')
      expect(config.color).toContain('red')
      expect(config.icon).toBeDefined()
    })

    it('should return config for feature', () => {
      const config = getSeverityConfig('feature')
      expect(config.label).toBe('Feature')
      expect(config.color).toContain('emerald')
      expect(config.icon).toBeDefined()
    })

    it('should return config for fix', () => {
      const config = getSeverityConfig('fix')
      expect(config.label).toBe('Fix')
      expect(config.color).toContain('violet')
      expect(config.icon).toBeDefined()
    })

    it('should return unique configs for each severity', () => {
      const configs = ALL_SEVERITIES.map(s => getSeverityConfig(s))
      const labels = configs.map(c => c.label)
      expect(new Set(labels).size).toBe(5)
    })

    it('should have icon for every severity', () => {
      for (const sev of ALL_SEVERITIES) {
        const config = getSeverityConfig(sev)
        expect(config.icon).toBeDefined()
        expect(config.icon).not.toBeNull()
      }
    })
  })
})
