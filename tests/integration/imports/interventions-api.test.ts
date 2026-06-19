/**
 * Tests d'intégration — POST /api/imports/interventions
 *
 * Mocks la couche API (@/lib/api) plutôt que Supabase directement, ce qui
 * supprime les chaînes de mocks fluent et laisse tourner les vrais
 * EnumResolver / EntityFinder sur des données canned.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

const { mockUser, mockSupabase, mockPermissions, mockApi } = vi.hoisted(() => {
  const mockUser = { id: 'user-abc', email: 'test@example.com' }

  const mockSupabase = { auth: { getUser: vi.fn() } }

  const mockPermissions = {
    requirePermission: vi.fn(),
    isPermissionError: vi.fn(),
  }

  const mockApi = {
    referentialsApi: {
      loadForImport: vi.fn(),
    },
    interventionsImportApi: {
      findIdsByIdInter: vi.fn(),
      // `runImport` appelle aussi `this.resolveByComposite` (matching par clé
      // composite agence/date/adresse, ajouté après l'écriture initiale de ce
      // test). Sans ce stub, `this.resolveByComposite is not a function` fait
      // rejeter le Promise.all interne → réponse 500. On le stube pour qu'il
      // ne renvoie aucun match composite : ces tests ciblent le matching par
      // id_inter (findIdsByIdInter) et la dédup, pas la résolution composite.
      resolveByComposite: vi.fn(),
      createFromImport: vi.fn(),
      updateFromImport: vi.fn(),
      bulkInsert: vi.fn(),
      bulkUpdateByIds: vi.fn(),
    },
  }

  return { mockUser, mockSupabase, mockPermissions, mockApi }
})

vi.mock('@/lib/supabase/server-ssr', () => ({
  createSSRServerClient: vi.fn().mockResolvedValue(mockSupabase),
}))

vi.mock('@/lib/auth/permissions', () => mockPermissions)

vi.mock('@/lib/api', () => mockApi)

// `runImport` importe directement `referentialsApi` depuis ce sous-module,
// donc le mock de `@/lib/api` ne le capte pas — on le mocke en plus.
vi.mock('@/lib/api/referentials', () => ({
  referentialsApi: mockApi.referentialsApi,
}))

// Branche la vraie implémentation `runImport` sur le mock pour qu'elle
// s'exécute contre les dépendances mockées (this.findIdsByIdInter, etc.).
const realImpl = await import('@/lib/api/interventions/interventions-import')
mockApi.interventionsImportApi.runImport = realImpl.interventionsImportApi.runImport

const { POST } = await import('../../../app/api/imports/interventions/route')

beforeAll(() => {
  if (typeof File !== 'undefined' && !File.prototype.text) {
    File.prototype.text = function (): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsText(this)
      })
    }
  }
})

const VALID_HEADER =
  "Date,Agence,Adresse d'intervention,ID,Statut,Contexte d'intervention," +
  "Métier,Gest.,Technicien,COUT SST,COÛT MATERIEL,Numéro SST,COUT INTER," +
  "% SST,PROPRIO,Date d'intervention,TEL LOC,Locataire,Em@il Locataire,COMMENTAIRE"

const VALID_ROW =
  "15/03/2024,PARIS,12 rue de la Paix 75001 Paris,INT-001,Nouvelle," +
  "Dégât des eaux,PLOMBERIE,,,120,0,,0,100,,,,,,"

function makeCsvContent(rows: string[] = [VALID_ROW]) {
  return [VALID_HEADER, ...rows].join('\n')
}

function makeRequest(csvContent: string, opts: { mode?: string; dryRun?: boolean } = {}) {
  const { mode = 'upsert', dryRun = false } = opts
  const formData = new FormData()
  formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'test.csv')
  formData.append('mode', mode)
  formData.append('dry_run', String(dryRun))

  const req = new NextRequest('http://localhost/api/imports/interventions', { method: 'POST' });
  (req as any).formData = vi.fn().mockResolvedValue(formData)
  return req
}

const STUB_REFS = {
  agencies: [{ id: 'agence-1', label: 'PARIS' }],
  metiers: [{ id: 'metier-1', label: 'PLOMBERIE' }],
  statuses: [{ id: 'statut-1', label: 'Nouvelle' }],
  users: [],
  artisans: [],
}

function setupApi(opts: {
  existingIdInters?: string[]
  insertError?: Error | null
  updateError?: Error | null
} = {}) {
  const { existingIdInters = [], insertError = null, updateError = null } = opts

  mockApi.referentialsApi.loadForImport.mockResolvedValue(STUB_REFS)

  const existingMap = new Map<string, string>(
    existingIdInters.map((idInter, i) => [idInter, `db-id-${i}`]),
  )
  mockApi.interventionsImportApi.findIdsByIdInter.mockResolvedValue(existingMap)

  // Aucun match par clé composite : la classification repose uniquement sur
  // les id_inter résolus par findIdsByIdInter ci-dessus.
  mockApi.interventionsImportApi.resolveByComposite.mockResolvedValue(
    new Map<number, string[]>(),
  )

  // Contrat réel respecté : bulkInsert renvoie le tableau des IDs insérés
  // (un par payload, dans l'ordre d'envoi). runImport fait `ids.length` puis
  // `inserted += chunk.length` — un retour `undefined` ferait planter sur
  // `.length` et déclencherait à tort le fallback per-row (double comptage).
  // Pour simuler une erreur DB : on rejette le bulk ET le per-row, afin
  // d'exercer le fallback puis l'attribution d'erreur ligne-par-ligne.
  mockApi.interventionsImportApi.bulkInsert.mockImplementation(
    async (_supabase: unknown, payloads: unknown[]) => {
      if (insertError) throw insertError
      return payloads.map((_, i) => `new-db-id-${i}`)
    },
  )
  mockApi.interventionsImportApi.bulkUpdateByIds.mockImplementation(async () => {
    if (updateError) throw updateError
  })
  mockApi.interventionsImportApi.createFromImport.mockImplementation(async () => {
    if (insertError) throw insertError
    return { id: 'new-db-id' }
  })
  mockApi.interventionsImportApi.updateFromImport.mockImplementation(async () => {
    if (updateError) throw updateError
  })
}

function setupAuthOk() {
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null })
  mockPermissions.requirePermission.mockResolvedValue({ user: mockUser })
  mockPermissions.isPermissionError.mockReturnValue(false)
}

describe('POST /api/imports/interventions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuthOk()
  })

  describe('authentification & permissions', () => {
    it('retourne 401 si non authentifié', async () => {
      mockPermissions.isPermissionError.mockReturnValue(true)
      mockPermissions.requirePermission.mockResolvedValue({
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      })

      const req = makeRequest(makeCsvContent())
      const res = await POST(req)
      expect(res.status).toBe(401)
    })
  })

  describe('validation du fichier', () => {
    it('retourne 400 si le champ file est absent', async () => {
      const formData = new FormData()
      formData.append('mode', 'upsert')
      const req = new NextRequest('http://localhost/api/imports/interventions', { method: 'POST' });
      (req as any).formData = vi.fn().mockResolvedValue(formData)
      setupApi()
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/champ.*file|file.*manquant/i)
    })

    it('retourne 400 si mode invalide', async () => {
      setupApi()
      const req = makeRequest(makeCsvContent(), { mode: 'invalid' })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/mode/i)
    })

    it('retourne 422 si CSV vide', async () => {
      setupApi()
      const req = makeRequest('')
      const res = await POST(req)
      expect(res.status).toBe(422)
    })

    it('retourne 422 si colonnes requises manquantes', async () => {
      setupApi()
      const req = makeRequest('ID,Statut\nINT-001,Nouvelle')
      const res = await POST(req)
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toMatch(/manquantes/i)
    })

    it('dédupe silencieusement les IDs en double (dernière occurrence gagne)', async () => {
      setupApi()
      const numericRow = VALID_ROW.replace('INT-001', '3763')
      const doubled = makeCsvContent([numericRow, numericRow])
      const req = makeRequest(doubled, { dryRun: true })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.valid).toBe(1)
    })
  })

  describe('dry-run', () => {
    it('retourne dry_run=true et total/valid sans écrire en base', async () => {
      setupApi()
      const req = makeRequest(makeCsvContent(), { dryRun: true })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.dry_run).toBe(true)
      expect(body.total).toBe(1)
      expect(body.valid).toBe(1)
      expect(mockApi.interventionsImportApi.bulkInsert).not.toHaveBeenCalled()
      expect(mockApi.interventionsImportApi.bulkUpdateByIds).not.toHaveBeenCalled()
      expect(mockApi.interventionsImportApi.createFromImport).not.toHaveBeenCalled()
      expect(mockApi.interventionsImportApi.updateFromImport).not.toHaveBeenCalled()
    })

    it('rapporte les erreurs de mapping sans écrire en base', async () => {
      setupApi()
      // Une agence inconnue n'invalide PAS une ligne : le mapper retombe sur
      // l'agence "DEFAUT" avec un simple warning (cf. intervention-mapper.ts).
      // Pour exercer le rapport d'erreurs de mapping, on déclenche une vraie
      // erreur : une Date invalide → InvalidRow (champ Date requis).
      const row = VALID_ROW.replace('15/03/2024', 'pas-une-date')
      const req = makeRequest(makeCsvContent([row]), { dryRun: true })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.dry_run).toBe(true)
      expect(body.valid).toBe(0)
      expect(body.errors.length).toBe(1)
      expect(body.errors[0].line).toBe(2)
    })
  })

  describe('mode create', () => {
    it('insère une ligne nouvelle (id_inter absent en base)', async () => {
      setupApi({ existingIdInters: [] })
      const req = makeRequest(makeCsvContent(), { mode: 'create' })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.inserted).toBe(1)
      expect(body.skipped).toBe(0)
      expect(mockApi.interventionsImportApi.bulkInsert).toHaveBeenCalledTimes(1)
    })

    it('ignore une ligne si id_inter existe déjà', async () => {
      setupApi({ existingIdInters: ['INT-001'] })
      const req = makeRequest(makeCsvContent(), { mode: 'create' })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.inserted).toBe(0)
      expect(body.skipped).toBe(1)
    })
  })

  describe('mode update', () => {
    it('met à jour une ligne existante', async () => {
      setupApi({ existingIdInters: ['INT-001'] })
      const req = makeRequest(makeCsvContent(), { mode: 'update' })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.updated).toBe(1)
      expect(body.skipped).toBe(0)
      expect(mockApi.interventionsImportApi.bulkUpdateByIds).toHaveBeenCalledTimes(1)
    })

    it('ignore une ligne si id_inter absent en base', async () => {
      setupApi({ existingIdInters: [] })
      const req = makeRequest(makeCsvContent(), { mode: 'update' })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.updated).toBe(0)
      expect(body.skipped).toBe(1)
    })
  })

  describe('mode upsert', () => {
    it('insère si absent, met à jour si présent', async () => {
      const row2 = VALID_ROW.replace('INT-001', 'INT-002')
      setupApi({ existingIdInters: ['INT-001'] })
      const req = makeRequest(makeCsvContent([VALID_ROW, row2]), { mode: 'upsert' })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.inserted).toBe(1)
      expect(body.updated).toBe(1)
      expect(body.skipped).toBe(0)
    })
  })

  describe('gestion des erreurs DB', () => {
    it('enregistre une erreur dans le rapport si l\'insert échoue', async () => {
      setupApi({ insertError: new Error('DB constraint violation') })
      const req = makeRequest(makeCsvContent(), { mode: 'upsert' })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.inserted).toBe(0)
      expect(body.errors.length).toBe(1)
      expect(body.errors[0].reason).toMatch(/DB constraint/i)
    })
  })
})
