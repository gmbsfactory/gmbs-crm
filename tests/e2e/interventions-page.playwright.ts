import { test, expect } from "@playwright/test"

test.describe("Interventions Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/interventions")
  })

  test("deep-link + virtualisation", async ({ page }) => {
    await page.goto("/interventions?view=grid&stage=Demandé&q=porte")
    
    // Vérifier que la vue grille est active
    await expect(page.getByRole("tab", { name: /vue grille/i })).toHaveAttribute("data-state", "active")
    
    // Vérifier que le stage est sélectionné
    await expect(page.getByRole("button", { name: /demandé/i })).toHaveClass(/bg-gray-500/)
    
    // Vérifier que la recherche est remplie
    await expect(page.getByPlaceholder(/rechercher/i)).toHaveValue("porte")
    
    // Vérifier l'URL
    await expect(page).toHaveURL(/view=grid/)
    await expect(page).toHaveURL(/stage=Demandé/)
    await expect(page).toHaveURL(/q=porte/)
  })

  test("virtualisation des cartes", async ({ page }) => {
    // Aller sur la vue grille
    await page.getByRole("tab", { name: /vue grille/i }).click()
    
    // Attendre que les cartes se chargent
    await page.waitForSelector("[data-test='deal-card']", { timeout: 10000 })
    
    // Vérifier qu'il n'y a pas trop de cartes dans le DOM (virtualisation)
    const cards = await page.locator("[data-test='deal-card']").count()
    expect(cards).toBeLessThan(60) // Normalement moins de 60 cartes visibles
  })

  test("filtrage par recherche", async ({ page }) => {
    // Remplir la recherche
    await page.getByPlaceholder(/rechercher/i).fill("serrure")
    
    // Vérifier que l'URL est mise à jour
    await expect(page).toHaveURL(/q=serrure/)
    
    // Attendre que le filtrage se fasse
    await page.waitForTimeout(500)
  })

  test("changement de vue", async ({ page }) => {
    // Aller sur la vue table
    await page.getByRole("tab", { name: /vue table/i }).click()
    await expect(page.getByRole("tab", { name: /vue table/i })).toHaveAttribute("data-state", "active")
    
    // Aller sur la vue liste
    await page.getByRole("tab", { name: /vue liste/i }).click()
    await expect(page.getByRole("tab", { name: /vue liste/i })).toHaveAttribute("data-state", "active")
  })

  test("filtrage par statut", async ({ page }) => {
    // Cliquer sur le statut "Terminé"
    await page.getByRole("button", { name: /terminé/i }).click()
    
    // Vérifier que l'URL est mise à jour
    await expect(page).toHaveURL(/stage=Terminé/)
    
    // Vérifier que le bouton est actif
    await expect(page.getByRole("button", { name: /terminé/i })).toHaveClass(/bg-gray-500/)
  })

  test("sélection de cartes", async ({ page }) => {
    // Aller sur la vue grille
    await page.getByRole("tab", { name: /vue grille/i }).click()
    
    // Attendre que les cartes se chargent
    await page.waitForSelector("[data-test='deal-card']", { timeout: 10000 })
    
    // Cliquer sur la première carte
    const firstCard = page.locator("[data-test='deal-card']").first()
    await firstCard.click()
    
    // Vérifier que la carte est sélectionnée
    await expect(firstCard).toHaveClass(/ring-2 ring-blue-500/)
  })

  test("error boundary", async ({ page }) => {
    // Simuler une erreur en injectant du JavaScript
    await page.addInitScript(() => {
      // Simuler une erreur dans le composant
      const originalError = console.error
      console.error = () => {} // Supprimer les logs d'erreur pour le test
      
      // Créer une erreur artificielle
      setTimeout(() => {
        throw new Error("Test error for boundary")
      }, 100)
    })
    
    // Vérifier que l'error boundary s'affiche
    await expect(page.getByText("Oups…")).toBeVisible({ timeout: 5000 })
  })
})
