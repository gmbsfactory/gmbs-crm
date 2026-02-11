import { describe, it, expect, vi } from 'vitest'
import { buildNavigation } from '@/config/navigation'

describe('config/navigation', () => {
  describe('buildNavigation', () => {
    const canAll = () => true
    const canNone = () => false
    const canAccessAll = () => true
    const canAccessNone = () => false

    it('should return navigation items when user has all permissions', () => {
      const nav = buildNavigation(canAll, canAccessAll)
      const links = nav.filter(item => item.type === 'link')
      expect(links.length).toBeGreaterThanOrEqual(4) // dashboard, interventions, comptabilite, artisans, params
    })

    it('should always include dashboard (no permission required)', () => {
      const nav = buildNavigation(canNone, canAccessNone)
      const links = nav.filter(item => item.type === 'link')
      const dashboard = links.find(l => l.type === 'link' && l.href === '/dashboard')
      expect(dashboard).toBeDefined()
    })

    it('should always include settings (no permission required)', () => {
      const nav = buildNavigation(canNone, canAccessNone)
      const links = nav.filter(item => item.type === 'link')
      const settings = links.find(l => l.type === 'link' && l.href === '/settings')
      expect(settings).toBeDefined()
    })

    it('should filter out interventions when no permission', () => {
      const nav = buildNavigation(canNone, canAccessNone)
      const links = nav.filter(item => item.type === 'link')
      const interventions = links.find(l => l.type === 'link' && l.href === '/interventions')
      expect(interventions).toBeUndefined()
    })

    it('should filter out artisans when no permission', () => {
      const nav = buildNavigation(canNone, canAccessNone)
      const links = nav.filter(item => item.type === 'link')
      const artisans = links.find(l => l.type === 'link' && l.href === '/artisans')
      expect(artisans).toBeUndefined()
    })

    it('should include spacers', () => {
      const nav = buildNavigation(canAll, canAccessAll)
      const spacers = nav.filter(item => item.type === 'spacer')
      expect(spacers.length).toBeGreaterThan(0)
    })

    it('should have resolved names (not functions)', () => {
      const nav = buildNavigation(canAll, canAccessAll)
      const links = nav.filter(item => item.type === 'link')
      for (const link of links) {
        if (link.type === 'link') {
          expect(typeof link.name).toBe('string')
          expect(link.name.length).toBeGreaterThan(0)
        }
      }
    })

    it('should allow selective permissions', () => {
      const canSelective = (perm: string) => perm === 'read_interventions'
      const nav = buildNavigation(canSelective as any, canAccessNone)
      const links = nav.filter(item => item.type === 'link')
      const interventions = links.find(l => l.type === 'link' && l.href === '/interventions')
      const artisans = links.find(l => l.type === 'link' && l.href === '/artisans')
      expect(interventions).toBeDefined()
      expect(artisans).toBeUndefined()
    })
  })
})
