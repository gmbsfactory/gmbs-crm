import { test, expect } from "@playwright/test"

test.describe("InterventionCard preview", () => {
  test("renders states and matches screenshot", async ({ page }) => {
    await page.goto("/previews/interventions-card")
    await page.waitForSelector("text=InterventionCard states")
    const grid = page.locator(".grid").first()
    await expect(grid).toBeVisible()
    // baseline screenshot; update if intentional changes
    await expect(grid).toHaveScreenshot("intervention-card-states.png", { maxDiffPixels: 0 })
  })
})

