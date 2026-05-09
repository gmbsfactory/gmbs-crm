import { test, expect } from '@playwright/test'
import { format } from 'date-fns'
import { readFileSync } from 'fs'

/**
 * E2E — CSV export from Settings → Profil
 *
 * Auth assumption (made explicit because the existing e2e suite has no login
 * helper, no storageState fixture, and no documented test user):
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars must be set for the
 *     authenticated specs. They are credentials for a user that exists in the
 *     local Supabase instance the dev server points at.
 *   - When they are absent, the authenticated specs are skipped rather than
 *     failing — the unauthenticated 401 spec always runs.
 *
 * The existing tests under tests/e2e/ never authenticate (they hit pages
 * directly and assume an unguarded dev environment). Rather than retrofit a
 * shared helper as part of this PR, the login flow is inlined here — when a
 * proper helper lands later, this file should adopt it.
 */

const EMAIL = process.env.TEST_USER_EMAIL
const PASSWORD = process.env.TEST_USER_PASSWORD
const HAS_CREDS = Boolean(EMAIL && PASSWORD)

const EXPECTED_HEADER =
  "Date,Agence,Adresse d'intervention,ID,Statut,Contexte d'intervention," +
  "Métier,Gest.,Technicien,COUT SST,COÛT MATERIEL,Numéro SST,COUT INTER," +
  "% SST,PROPRIO,Date d'intervention,TEL LOC,Locataire,Em@il Locataire," +
  "COMMENTAIRE"

test.describe('Settings — Export interventions CSV', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.title.includes('unauthenticated')) return
    test.skip(!HAS_CREDS, 'TEST_USER_EMAIL / TEST_USER_PASSWORD not set')

    await page.goto('/login')
    await page.getByPlaceholder(/alice@gmbs/i).fill(EMAIL!)
    // Le <label> "Mot de passe" n'est pas associé via htmlFor — cibler l'input directement.
    await page.locator('input[type="password"]').fill(PASSWORD!)
    await page.getByRole('button', { name: /se connecter/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 10_000,
    })
  })

  test('happy path — downloads CSV with BOM and exact header row', async ({ page }) => {
    await page.goto('/settings/profile')

    // Ouvrir la carte (en-tête cliquable)
    await page.getByRole('button', { name: /exporter mes interventions/i }).click()

    const exportBtn = page.getByRole('button', { name: /exporter en csv/i })
    await expect(exportBtn).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click(),
    ])

    const today = format(new Date(), 'yyyy-MM-dd')
    expect(download.suggestedFilename()).toBe(`Export_Interventions_${today}.csv`)

    const path = await download.path()
    expect(path).toBeTruthy()
    const buf = readFileSync(path!)

    // BOM UTF-8
    expect(buf[0]).toBe(0xef)
    expect(buf[1]).toBe(0xbb)
    expect(buf[2]).toBe(0xbf)

    const text = buf.subarray(3).toString('utf8')
    const firstLine = text.split(/\r?\n/, 1)[0]
    expect(firstLine).toBe(EXPECTED_HEADER)
  })

  test('date range > 12 months — warns but still exports', async ({ page }) => {
    await page.goto('/settings/profile')
    await page.getByRole('button', { name: /exporter mes interventions/i }).click()

    // Ouvrir le popover du DateRangePicker (id stable sur le trigger : voir DateRangePicker.tsx)
    await page.locator('#date-range').click()

    // Naviguer 24 mois en arrière via le bouton "mois précédent" de react-day-picker.
    // Locale fr → aria-label "Aller au mois précédent" / fallback EN "previous".
    const prev = page.getByRole('button', { name: /précédent|previous/i })
    for (let i = 0; i < 24; i++) await prev.click()

    // Sélectionner le 1er du mois affiché (début de plage)
    await page.getByRole('gridcell', { name: /^1$/ }).first().click()

    // Revenir au mois courant
    const next = page.getByRole('button', { name: /suivant|next/i })
    for (let i = 0; i < 24; i++) await next.click()

    // Sélectionner aujourd'hui (fin de plage)
    const todayDay = String(new Date().getDate())
    await page
      .getByRole('gridcell', { name: new RegExp(`^${todayDay}$`) })
      .last()
      .click()

    // Fermer le popover pour ne pas masquer la bannière
    await page.keyboard.press('Escape')

    await expect(
      page.getByText(/la période sélectionnée dépasse 12 mois/i)
    ).toBeVisible()

    const exportBtn = page.getByRole('button', { name: /exporter en csv/i })
    await expect(exportBtn).toBeEnabled()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^Export_Interventions_\d{4}-\d{2}-\d{2}\.csv$/)
  })

  test('unauthenticated — GET /api/exports/interventions returns 401', async ({ request }) => {
    const res = await request.get('/api/exports/interventions')
    expect(res.status()).toBe(401)
  })
})
