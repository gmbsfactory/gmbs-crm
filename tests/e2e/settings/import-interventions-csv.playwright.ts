import { test, expect } from '@playwright/test'
import { writeFileSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * E2E — CSV import depuis Settings → Profil
 *
 * Même convention que export-interventions-csv.playwright.ts :
 * - TEST_USER_EMAIL / TEST_USER_PASSWORD requis pour les specs authentifiées
 * - La spec unauthenticated tourne toujours
 */

const EMAIL = process.env.TEST_USER_EMAIL
const PASSWORD = process.env.TEST_USER_PASSWORD
const HAS_CREDS = Boolean(EMAIL && PASSWORD)

const VALID_HEADER =
  "Date,Agence,Adresse d'intervention,ID,Statut,Contexte d'intervention," +
  "Métier,Gest.,Technicien,COUT SST,COÛT MATERIEL,Numéro SST,COUT INTER," +
  "% SST,PROPRIO,Date d'intervention,TEL LOC,Locataire,Em@il Locataire,COMMENTAIRE"

const VALID_ROW =
  "15/03/2024,PARIS,12 rue de la Paix 75001 Paris,INT-E2E-001,Nouvelle," +
  "Test E2E,PLOMBERIE,,,120,0,,0,100,,,,,,"

function writeTempCsv(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'gmbs-e2e-'))
  const path = join(dir, 'test-import.csv')
  writeFileSync(path, content, 'utf8')
  return path
}

test.describe('Settings — Import interventions CSV', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.title.includes('unauthenticated')) return
    test.skip(!HAS_CREDS, 'TEST_USER_EMAIL / TEST_USER_PASSWORD not set')

    await page.goto('/login')
    await page.getByPlaceholder(/alice@gmbs/i).fill(EMAIL!)
    await page.locator('input[type="password"]').fill(PASSWORD!)
    await page.getByRole('button', { name: /se connecter/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 10_000,
    })
  })

  test('happy path — carte visible et section dépliable', async ({ page }) => {
    await page.goto('/settings/profile')

    // La carte Import doit être présente
    const importToggle = page.getByRole('button', { name: /importer des interventions/i })
    await expect(importToggle).toBeVisible()

    // Déplie la carte
    await importToggle.click()

    // Zone de dépôt visible
    await expect(page.getByText(/glissez un fichier csv ici/i)).toBeVisible()

    // Sélecteur de mode
    await expect(page.getByRole('button', { name: /upsert/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /créer uniquement/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /mettre à jour/i })).toBeVisible()

    // Checkbox dry-run
    await expect(page.getByRole('checkbox')).toBeVisible()

    // Bouton import désactivé sans fichier
    const importBtn = page.getByRole('button', { name: /importer le fichier/i })
    await expect(importBtn).toBeDisabled()
  })

  test('upload fichier — aperçu affiché avec nombre de lignes', async ({ page }) => {
    const csvPath = writeTempCsv([VALID_HEADER, VALID_ROW].join('\n'))
    await page.goto('/settings/profile')
    await page.getByRole('button', { name: /importer des interventions/i }).click()

    // Injecter le fichier via l'input caché
    const fileInput = page.locator('input[type="file"][accept=".csv"]')
    await fileInput.setInputFiles(csvPath)

    // L'aperçu doit apparaître avec 1 ligne détectée
    await expect(page.getByText(/1 ligne détectée/i)).toBeVisible()

    // L'en-tête du tableau doit contenir la colonne ID
    await expect(page.locator('th', { hasText: 'ID' })).toBeVisible()

    // Le bouton import doit être actif
    await expect(page.getByRole('button', { name: /importer le fichier/i })).toBeEnabled()
  })

  test('simulation (dry-run) — rapport affiché sans erreur', async ({ page }) => {
    const csvPath = writeTempCsv([VALID_HEADER, VALID_ROW].join('\n'))
    await page.goto('/settings/profile')
    await page.getByRole('button', { name: /importer des interventions/i }).click()

    const fileInput = page.locator('input[type="file"][accept=".csv"]')
    await fileInput.setInputFiles(csvPath)

    // Activer dry-run
    await page.getByRole('checkbox').check()
    await expect(page.getByRole('button', { name: /valider sans importer/i })).toBeVisible()

    // Lancer la validation
    await page.getByRole('button', { name: /valider sans importer/i }).click()

    // Attendre le rapport
    await expect(
      page.getByText(/résultat de la simulation/i)
    ).toBeVisible({ timeout: 15_000 })

    // La stat "Total lignes" doit être présente
    await expect(page.getByText(/total lignes/i)).toBeVisible()
  })

  test('fichier avec mauvaise extension — toast d\'erreur', async ({ page }) => {
    const dir = mkdtempSync(join(tmpdir(), 'gmbs-e2e-'))
    const badPath = join(dir, 'test.txt')
    writeFileSync(badPath, 'not a csv', 'utf8')

    await page.goto('/settings/profile')
    await page.getByRole('button', { name: /importer des interventions/i }).click()

    const fileInput = page.locator('input[type="file"][accept=".csv"]')
    // On force le set même si accept=".csv" — le composant valide côté JS
    await fileInput.setInputFiles(badPath)

    await expect(page.getByText(/format invalide/i)).toBeVisible({ timeout: 5_000 })
  })

  test('changer de fichier — réinitialise l\'aperçu', async ({ page }) => {
    const csvPath = writeTempCsv([VALID_HEADER, VALID_ROW].join('\n'))
    await page.goto('/settings/profile')
    await page.getByRole('button', { name: /importer des interventions/i }).click()

    const fileInput = page.locator('input[type="file"][accept=".csv"]')
    await fileInput.setInputFiles(csvPath)
    await expect(page.getByText(/1 ligne détectée/i)).toBeVisible()

    // Cliquer sur "Changer de fichier"
    await page.getByRole('button', { name: /changer de fichier/i }).click()

    // L'aperçu disparaît
    await expect(page.getByText(/1 ligne détectée/i)).not.toBeVisible()

    // La zone de dépôt originale réapparaît
    await expect(page.getByText(/glissez un fichier csv ici/i)).toBeVisible()

    // Le bouton import est à nouveau désactivé
    await expect(page.getByRole('button', { name: /importer le fichier/i })).toBeDisabled()
  })

  test('unauthenticated — POST /api/imports/interventions retourne 401', async ({ request }) => {
    const formData = new FormData()
    formData.append('file', new Blob(['a,b\n1,2'], { type: 'text/csv' }), 'test.csv')
    formData.append('mode', 'upsert')
    formData.append('dry_run', 'false')

    const res = await request.post('/api/imports/interventions', {
      multipart: {
        file: {
          name: 'test.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('a,b\n1,2'),
        },
        mode: 'upsert',
        dry_run: 'false',
      },
    })
    expect(res.status()).toBe(401)
  })
})
