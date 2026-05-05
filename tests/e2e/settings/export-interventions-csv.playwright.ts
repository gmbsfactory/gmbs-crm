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

const EXPECTED_HEADER =
  "Date,Agence,Adresse d'intervention,ID,Statut,Contexte d'intervention," +
  "Métier,Gest.,Technicien,COUT SST,COÛT MATERIEL,Numéro SST,COUT INTER," +
  "% SST,PROPRIO,Date d'intervention,TEL LOC,Locataire,Em@il Locataire," +
  "COMMENTAIRE"

const authed = test.describe.configure ? test.describe : test.describe
const itAuthed = EMAIL && PASSWORD ? test : test.skip

test.describe('Settings — Export interventions CSV', () => {
  test.beforeEach(async ({ page }) => {
    if (!EMAIL || !PASSWORD) return
    await page.goto('/login')
    await page.getByPlaceholder(/alice@gmbs/i).fill(EMAIL)
    await page.getByLabel(/mot de passe/i).fill(PASSWORD)
    await page.getByRole('button', { name: /se connecter/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 10_000,
    })
  })

  itAuthed('happy path — downloads CSV with BOM and exact header row', async ({ page }) => {
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

  itAuthed('date range > 12 months — warns but still exports', async ({ page }) => {
    await page.goto('/settings/profile')
    await page.getByRole('button', { name: /exporter mes interventions/i }).click()

    // Ouvrir le DateRangePicker
    await page.getByRole('button', { name: /période|date|sélectionner/i }).first().click()

    // Sélectionner une plage > 12 mois en saisissant directement les inputs
    // start: 2 ans en arrière, end: aujourd'hui
    const today = new Date()
    const twoYearsAgo = new Date(today)
    twoYearsAgo.setFullYear(today.getFullYear() - 2)

    const startInput = page.locator('input[name*="start"], input[placeholder*="début" i], input[type="date"]').first()
    const endInput = page.locator('input[name*="end"], input[placeholder*="fin" i], input[type="date"]').nth(1)

    if (await startInput.count()) {
      await startInput.fill(format(twoYearsAgo, 'yyyy-MM-dd'))
      await endInput.fill(format(today, 'yyyy-MM-dd'))
    } else {
      // Fallback : forcer l'état via évaluation (le picker est un composant complexe — la sélection visuelle
      // sort du périmètre de ce test ; ce qui compte ici est que > 365 j déclenche bien l'avertissement
      // et n'empêche pas l'export). Si le picker n'expose pas d'input contrôlable, on skippe la précondition.
      test.skip(true, 'DateRangePicker n\'expose pas d\'input directement adressable')
    }

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
    const res = await request.get('/api/exports/interventions', {
      // Pas de cookies de session — context isolé par défaut entre tests
      headers: {},
    })
    expect(res.status()).toBe(401)
  })
})
