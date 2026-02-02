import { test, expect } from '@playwright/test'

test.describe('InterventionCard preview', () => {
  test('renders and matches snapshot', async ({ page }) => {
    await page.goto('/previews/interventions-card')
    // Wait for cards to render
    await expect(page.locator('[data-intervention-id]')).toHaveCount(6)
    // Basic visual snapshot (kept small for CI perf)
    expect(await page.screenshot({ fullPage: false })).toMatchSnapshot('interventions-card.png', { maxDiffPixelRatio: 0.01 })
  })
})

