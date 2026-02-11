# Standards de test

> Politique de tests, conventions et guide pour écrire des tests dans GMBS-CRM.

---

## Politique de test

### Règle fondamentale

**Toute nouvelle feature ou modification de code existant DOIT inclure des tests.**

### Couverture attendue par priorité

| Priorité | Type | Couverture cible |
|----------|------|-----------------|
| Critique | Workflow / transitions de statuts | 100% |
| Critique | Calculs métier (marge, coûts) | 100% |
| Haute | Hooks custom (useInterventionsQuery, etc.) | 80%+ |
| Haute | Fonctions API (interventionsApi.ts) | 80%+ |
| Moyenne | Composants avec logique conditionnelle | 60%+ |
| Basse | Composants UI simples | Optionnel |

### Seuils de couverture globaux

Définis dans `vitest.config.ts` :

```typescript
coverage: {
  thresholds: {
    global: {
      statements: 30,
      branches: 30,
      functions: 30,
      lines: 30,
    },
  },
}
```

---

## Configuration

### Vitest

Le projet utilise **Vitest 3.2** avec l'environnement **jsdom**.

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,              // describe, it, expect sans import
    environment: "jsdom",       // Simulation DOM
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/tests/visual/**", "**/tests/e2e/**"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
})
```

### Setup global

Le fichier `tests/setup.ts` configure l'environnement de test :

```typescript
// Mocks globaux
global.fetch = vi.fn()
window.matchMedia = vi.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  addListener: vi.fn(),
  removeListener: vi.fn(),
}))
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Cleanup automatique
afterEach(() => { vi.clearAllMocks() })
```

### Playwright (E2E)

```typescript
// playwright.config.ts
{
  use: { headless: true, baseURL: 'http://localhost:3000' },
  webServer: { command: 'pnpm dev', port: 3000 },
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
}
```

---

## Structure des tests

```
tests/
  __fixtures__/                    # Données mock réutilisables
    interventions.ts               # Factory d'interventions
  __mocks__/                       # Mocks partagés
    supabase.ts                    # Export mock Supabase
    supabase/
      supabase-mock-builder.ts     # Builder pattern pour mocks
    fixtures/
      dashboard-stats.fixtures.ts
  setup.ts                         # Setup global Vitest
  unit/                            # Tests unitaires (~48 fichiers)
    components/                    # Tests composants
    config/                        # Tests configuration
    dashboard/                     # Tests dashboard
    hooks/                         # Tests hooks
    lib/                           # Tests librairies (~35 fichiers)
      interventions/               # Tests API interventions
      workflow/                    # Tests workflow
      react-query/                 # Tests query keys
      realtime/                    # Tests cache sync
  integration/                     # Tests d'intégration
    realtime-sync.test.ts
  e2e/                             # Tests end-to-end (Playwright)
    interventions.playwright.ts
    interventions-page.playwright.ts
  visual/                          # Tests visuels
    intervention-card.playwright.ts
```

### Conventions de nommage

| Convention | Règle |
|------------|-------|
| Fichier test | `<fichier-source>.test.ts` ou `.spec.ts` |
| Un fichier test | Par fichier source |
| Structure | `describe('NomDuModule')` > `describe('fonction')` > `it('should ...')` |

---

## Écriture des tests

### Template standard

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('NomDuModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('nomDeLaFonction', () => {
    it('should <comportement nominal>', () => {
      // Arrange
      const input = createMockData()

      // Act
      const result = fonctionATest(input)

      // Assert
      expect(result).toEqual(expectedOutput)
    })

    it('should throw when <cas erreur>', () => {
      // Arrange
      const invalidInput = {}

      // Act & Assert
      expect(() => fonctionATest(invalidInput)).toThrow()
    })
  })
})
```

### Pattern AAA (Arrange-Act-Assert)

Chaque test suit le pattern :
1. **Arrange** : préparer les données et mocks
2. **Act** : exécuter la fonction ou action
3. **Assert** : vérifier le résultat

---

## Mocks

### Mock Supabase (Builder Pattern)

Le projet fournit un builder fluent pour mocker les appels Supabase :

```typescript
import { SupabaseMockBuilder } from '../__mocks__/supabase/supabase-mock-builder'

const mock = new SupabaseMockBuilder()
  .forTable('interventions', { data: mockInterventions, error: null })
  .forTable('artisans', { data: mockArtisans, error: null })
  .forRpc('get_intervention_history', { data: mockHistory, error: null })
  .build()
```

**Méthodes du builder :**
- `forTable<T>(tableName, result)` : mock les appels `.from(tableName)`
- `forRpc<T>(rpcName, result)` : mock les appels `.rpc(rpcName)`
- `withDefaultResult(result)` : résultat par défaut pour les tables non configurées
- `build()` : retourne l'objet mock `{ from, rpc }`

### Fixtures

```typescript
// tests/__fixtures__/interventions.ts
export function createMockIntervention(overrides?: Partial<Intervention>): Intervention {
  return {
    id: 'test-uuid',
    id_inter: 'INT-001',
    statut_id: 'status-demande-uuid',
    // ... valeurs par défaut
    ...overrides,
  }
}
```

### Mocking des modules

```typescript
// Mock d'un module complet
vi.mock('@/lib/api/v2/common/client', () => ({
  supabase: mockSupabase,
  getSupabaseClientForNode: () => mockSupabase,
}))

// Mock partiel
vi.mock('@/lib/api/v2/common/cache', async () => {
  const actual = await vi.importActual('@/lib/api/v2/common/cache')
  return {
    ...actual,
    getReferenceCache: vi.fn().mockResolvedValue(mockCache),
  }
})
```

---

## Workflow de développement (TDD)

### Approche recommandée

1. **Écrire les tests** qui décrivent le comportement attendu
2. **Implémenter le code** jusqu'a ce que les tests passent
3. **Refactoriser** si nécessaire
4. **Vérifier** : `npm run test` sans régression

### Checklist avant validation

- [ ] Tests unitaires écrits pour la nouvelle logique
- [ ] Tests passent localement (`npm run test`)
- [ ] Pas de régression sur les tests existants
- [ ] Coverage n'a pas diminué

---

## Commandes

```bash
# Lancer tous les tests
npm run test

# Mode watch (re-run automatique)
npm run test:watch

# Tests E2E (nécessite le serveur dev)
npx playwright test

# Couverture
npx vitest run --coverage
```

---

## Fichiers critiques a tester

Ces fichiers sont au coeur du système. Toute modification nécessite des tests :

| Fichier | Couverture requise |
|---------|-------------------|
| `src/lib/api/v2/interventions/*.ts` | 80%+ |
| `src/lib/workflow/` | 100% |
| `src/lib/realtime/cache-sync*.ts` | 80%+ |
| `src/hooks/useInterventionsQuery.ts` | 80%+ |
| `src/hooks/usePermissions.ts` | 80%+ |
| `src/lib/api/v2/common/cache.ts` | 80%+ |
