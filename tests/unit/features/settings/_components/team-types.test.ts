import { describe, it, expect } from 'vitest'
import {
  getRoleConfig,
  getAllRoleConfigs,
  TEAM_ROLE_CONFIG,
} from '@/features/settings/_components/team-types'

describe('team-types', () => {
  describe('getRoleConfig', () => {
    it('should return dev config for "dev"', () => {
      const config = getRoleConfig('dev')
      expect(config.label).toBe('Dev')
    })

    it('should return admin config for "admin"', () => {
      const config = getRoleConfig('admin')
      expect(config.label).toBe('Admin')
    })

    it('should return manager config for "manager"', () => {
      const config = getRoleConfig('manager')
      expect(config.label).toBe('Manager')
    })

    it('should return gestionnaire config for "gestionnaire"', () => {
      const config = getRoleConfig('gestionnaire')
      expect(config.label).toBe('Gestionnaire')
    })

    it('should default to gestionnaire for null', () => {
      const config = getRoleConfig(null)
      expect(config.label).toBe('Gestionnaire')
    })

    it('should default to gestionnaire for unknown role', () => {
      const config = getRoleConfig('unknown')
      expect(config.label).toBe('Gestionnaire')
    })

    it('should be case insensitive', () => {
      const config = getRoleConfig('Admin')
      expect(config.label).toBe('Admin')
    })
  })

  describe('getAllRoleConfigs', () => {
    it('should return configs for multiple roles', () => {
      const configs = getAllRoleConfigs(['admin', 'dev'])
      expect(configs).toHaveLength(2)
      expect(configs[0].key).toBe('admin')
      expect(configs[1].key).toBe('dev')
    })

    it('should return empty array for empty roles', () => {
      const configs = getAllRoleConfigs([])
      expect(configs).toEqual([])
    })

    it('should filter out unknown roles', () => {
      const configs = getAllRoleConfigs(['admin', 'unknown', 'dev'])
      expect(configs).toHaveLength(2)
    })

    it('should return single config for single role', () => {
      const configs = getAllRoleConfigs(['gestionnaire'])
      expect(configs).toHaveLength(1)
      expect(configs[0].key).toBe('gestionnaire')
    })

    it('should return all 4 configs for all known roles', () => {
      const configs = getAllRoleConfigs(['dev', 'admin', 'manager', 'gestionnaire'])
      expect(configs).toHaveLength(4)
    })

    it('should have correct structure for each config', () => {
      const configs = getAllRoleConfigs(['admin'])
      expect(configs[0]).toHaveProperty('icon')
      expect(configs[0]).toHaveProperty('color')
      expect(configs[0]).toHaveProperty('bg')
      expect(configs[0]).toHaveProperty('label')
      expect(configs[0]).toHaveProperty('key')
    })
  })
})
