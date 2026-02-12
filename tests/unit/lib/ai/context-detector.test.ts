import { describe, it, expect } from 'vitest'
import { detectContext, isActionAvailable, getDefaultAction } from '@/lib/ai/context-detector'

describe('context-detector', () => {
  describe('detectContext', () => {
    it('should detect intervention detail page', () => {
      const ctx = detectContext('/interventions/550e8400-e29b-41d4-a716-446655440000')
      expect(ctx.page).toBe('intervention_detail')
      expect(ctx.entityId).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(ctx.entityType).toBe('intervention')
      expect(ctx.availableActions).toContain('summary')
      expect(ctx.availableActions).toContain('next_steps')
      expect(ctx.availableActions).toContain('email_artisan')
      expect(ctx.availableActions).toContain('find_artisan')
    })

    it('should detect intervention list page', () => {
      const ctx = detectContext('/interventions')
      expect(ctx.page).toBe('intervention_list')
      expect(ctx.entityId).toBeNull()
      expect(ctx.entityType).toBe('intervention')
      expect(ctx.availableActions).toContain('suggestions')
      expect(ctx.availableActions).toContain('stats_insights')
    })

    it('should detect artisan detail page', () => {
      const ctx = detectContext('/artisans/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(ctx.page).toBe('artisan_detail')
      expect(ctx.entityId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(ctx.entityType).toBe('artisan')
      expect(ctx.availableActions).toContain('summary')
    })

    it('should detect artisan list page', () => {
      const ctx = detectContext('/artisans')
      expect(ctx.page).toBe('artisan_list')
      expect(ctx.entityType).toBe('artisan')
    })

    it('should detect dashboard page', () => {
      const ctx = detectContext('/dashboard')
      expect(ctx.page).toBe('dashboard')
      expect(ctx.entityId).toBeNull()
      expect(ctx.entityType).toBeNull()
      expect(ctx.availableActions).toContain('stats_insights')
    })

    it('should detect admin dashboard page', () => {
      const ctx = detectContext('/admin/dashboard')
      expect(ctx.page).toBe('admin_dashboard')
    })

    it('should detect admin analytics page', () => {
      const ctx = detectContext('/admin/analytics')
      expect(ctx.page).toBe('admin_dashboard')
    })

    it('should detect comptabilite page', () => {
      const ctx = detectContext('/comptabilite')
      expect(ctx.page).toBe('comptabilite')
      expect(ctx.availableActions).toContain('stats_insights')
    })

    it('should detect settings page with no actions', () => {
      const ctx = detectContext('/settings')
      expect(ctx.page).toBe('settings')
      expect(ctx.availableActions).toHaveLength(0)
    })

    it('should return unknown for unrecognized paths', () => {
      const ctx = detectContext('/some/random/page')
      expect(ctx.page).toBe('unknown')
      expect(ctx.availableActions).toHaveLength(0)
    })

    it('should preserve the pathname', () => {
      const path = '/interventions/550e8400-e29b-41d4-a716-446655440000'
      const ctx = detectContext(path)
      expect(ctx.pathname).toBe(path)
    })
  })

  describe('isActionAvailable', () => {
    it('should return true for available action', () => {
      const ctx = detectContext('/interventions/550e8400-e29b-41d4-a716-446655440000')
      expect(isActionAvailable(ctx, 'summary')).toBe(true)
    })

    it('should return false for unavailable action', () => {
      const ctx = detectContext('/settings')
      expect(isActionAvailable(ctx, 'summary')).toBe(false)
    })
  })

  describe('getDefaultAction', () => {
    it('should return summary for intervention detail', () => {
      const ctx = detectContext('/interventions/550e8400-e29b-41d4-a716-446655440000')
      expect(getDefaultAction(ctx)).toBe('summary')
    })

    it('should return summary for artisan detail', () => {
      const ctx = detectContext('/artisans/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(getDefaultAction(ctx)).toBe('summary')
    })

    it('should return first available action for list pages', () => {
      const ctx = detectContext('/interventions')
      expect(getDefaultAction(ctx)).toBe('suggestions')
    })

    it('should return null for settings (no actions)', () => {
      const ctx = detectContext('/settings')
      expect(getDefaultAction(ctx)).toBeNull()
    })
  })
})
