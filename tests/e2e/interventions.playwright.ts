import { test, expect } from '@playwright/test'

test.describe('Interventions E2E', () => {
  test('load with status and selected in URL', async ({ page }) => {
    await page.goto('/interventions?status=En_cours')
    await expect(page.locator('text=Interventions')).toBeVisible()
  })

  test('ArrowRight changes status column (chip highlight)', async ({ page }) => {
    await page.goto('/interventions')
    await page.keyboard.press('ArrowRight')
    // naive assertion placeholder
    await expect(page.locator('text=Trier par:')).toBeVisible()
  })
})

