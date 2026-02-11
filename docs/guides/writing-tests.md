# Ecrire des tests

Guide complet pour ecrire des tests dans GMBS-CRM : tests unitaires, tests d'integration, tests E2E et mocks Supabase.

---

## Table des matieres

1. [Vue d'ensemble](#1-vue-densemble)
2. [Configuration](#2-configuration)
3. [Tests unitaires](#3-tests-unitaires)
4. [Mocks Supabase](#4-mocks-supabase)
5. [Fixtures](#5-fixtures)
6. [Tests d'integration](#6-tests-dintegration)
7. [Tests E2E (Playwright)](#7-tests-e2e-playwright)
8. [Commandes](#8-commandes)
9. [Bonnes pratiques](#9-bonnes-pratiques)

---

## 1. Vue d'ensemble

### Structure des tests

```
tests/
  __fixtures__/              # Donnees de test reutilisables
    interventions.ts         # Factory mock interventions
  __mocks__/                 # Mocks globaux
    supabase.ts              # Mock client Supabase
    supabase/
      supabase-mock-builder.ts  # Builder pattern fluent
    fixtures/
      dashboard-stats.fixtures.ts
  setup.ts                   # Setup global (fetch, matchMedia, etc.)
  unit/                      # ~48 fichiers
    components/              # Tests composants avec logique
    config/                  # Tests config workflow
    dashboard/               # Tests stats, marge
    hooks/                   # Tests hooks custom
    lib/                     # Tests utilitaires et API
      interventions/         # Tests CRUD, status, formulaire
      workflow/              # Tests validation cumulative
      realtime/              # Tests cache sync
  integration/               # Tests d'integration
    realtime-sync.test.ts
  e2e/                       # Tests end-to-end Playwright
    interventions.playwright.ts
    interventions-page.playwright.ts
  visual/                    # Tests visuels Playwright
    intervention-card.playwright.ts
```

### Priorites de test

| Priorite | Type | Couverture attendue |
|----------|------|---------------------|
| Critique | Workflow/transitions de statuts | 100% |
| Critique | Calculs metier (marge, couts) | 100% |
| Haute | Hooks custom | 80%+ |
| Haute | Fonctions API | 80%+ |
| Moyenne | Composants avec logique conditionnelle | 60%+ |
| Basse | Composants UI simples | Optionnel |

---

## 2. Configuration

### Vitest (`vitest.config.ts`)

```typescript
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,              // describe, it, expect sans import
    environment: "jsdom",       // Simule le DOM
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules", ".next", "out",
      "**/tests/visual/**",     // Exclut tests visuels (Playwright)
      "**/tests/e2e/**",        // Exclut tests E2E (Playwright)
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        global: {
          statements: 30, branches: 30, functions: 30, lines: 30,
        },
      },
    },
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
})
```

### Setup global (`tests/setup.ts`)

Le fichier de setup mock les API navigateur non disponibles dans jsdom :

```typescript
import { vi } from "vitest"
import "@testing-library/jest-dom"

// Mock global fetch
global.fetch = vi.fn()

// Mock window.matchMedia (requis par certains composants UI)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks()
})
```

---

## 3. Tests unitaires

### Convention de nommage

- Fichier test : `<nom-du-module>.test.ts` ou `.spec.ts`
- Un fichier test par fichier source
- Structure : `describe('NomDuModule')` -> `it('should <comportement>')`

### Template de base

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

describe("NomDuModule", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("nomDeLaFonction", () => {
    it("should <comportement nominal>", () => {
      // Arrange
      const input = createMockData()

      // Act
      const result = fonctionATest(input)

      // Assert
      expect(result).toEqual(expectedOutput)
    })

    it("should throw when <cas erreur>", () => {
      expect(() => fonctionATest(invalidInput)).toThrow()
    })
  })
})
```

### Exemple reel : Calculateur de marge

Tire de `tests/unit/lib/margin-calculator.test.ts` :

```typescript
import { describe, it, expect } from "vitest"
import {
  calculatePrimaryArtisanMargin,
  formatMarginPercentage,
  getMarginColorClass,
} from "@/lib/utils/margin-calculator"

describe("margin-calculator", () => {
  describe("calculatePrimaryArtisanMargin", () => {
    it("should calculate margin correctly", () => {
      const result = calculatePrimaryArtisanMargin(1000, 600, 100)
      expect(result.marginPercentage).toBe(30)
      expect(result.marginValue).toBe(300)
      expect(result.revenue).toBe(1000)
      expect(result.totalCosts).toBe(700)
      expect(result.isValid).toBe(true)
    })

    it("should handle string inputs", () => {
      const result = calculatePrimaryArtisanMargin("1000", "600", "100")
      expect(result.marginPercentage).toBe(30)
      expect(result.isValid).toBe(true)
    })

    it("should return invalid for zero revenue", () => {
      const result = calculatePrimaryArtisanMargin(0, 100, 50)
      expect(result.isValid).toBe(false)
      expect(result.marginPercentage).toBe(0)
    })

    it("should handle NaN inputs as 0", () => {
      const result = calculatePrimaryArtisanMargin("invalid", "bad", "data")
      expect(result.isValid).toBe(false)
      expect(result.revenue).toBe(0)
    })

    it("should handle 100% margin (no costs)", () => {
      const result = calculatePrimaryArtisanMargin(1000, 0, 0)
      expect(result.marginPercentage).toBe(100)
      expect(result.marginValue).toBe(1000)
    })
  })

  describe("formatMarginPercentage", () => {
    it("should format with default 1 decimal", () => {
      expect(formatMarginPercentage(30.567)).toBe("30.6 %")
    })

    it("should format negative margin", () => {
      expect(formatMarginPercentage(-15.3)).toBe("-15.3 %")
    })
  })

  describe("getMarginColorClass", () => {
    it("should return destructive for negative margin", () => {
      expect(getMarginColorClass(-5)).toBe("text-destructive")
    })

    it("should return green for positive margin", () => {
      expect(getMarginColorClass(30)).toBe("text-green-600")
    })
  })
})
```

### Tester un hook avec React Testing Library

```typescript
import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// Creer un wrapper avec QueryClientProvider pour les hooks TanStack Query
function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe("useMyHook", () => {
  it("should fetch and return data", async () => {
    // Mock de la dependance API
    vi.mock("@/lib/api/v2", () => ({
      myApi: {
        getAll: vi.fn().mockResolvedValue([{ id: "1" }]),
      },
    }))

    const { useMyHook } = await import("@/hooks/useMyHook")
    const { result } = renderHook(() => useMyHook(), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })
})
```

---

## 4. Mocks Supabase

### Mock simple (`tests/__mocks__/supabase.ts`)

```typescript
import { vi } from "vitest"

export const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
  })),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  })),
}

export const mockSupabaseResponse = <T>(data: T, error: null | Error = null) => ({
  data,
  error,
  count: Array.isArray(data) ? data.length : null,
})
```

### Mock Builder (`tests/__mocks__/supabase/supabase-mock-builder.ts`)

Pour des tests plus complexes avec plusieurs tables :

```typescript
import { SupabaseMockBuilder, createSimpleSupabaseMock } from "tests/__mocks__/supabase"

// Mock simple pour une table
const mock = createSimpleSupabaseMock([{ id: "1", name: "Test" }])
vi.mocked(supabase.from).mockImplementation(mock.from)

// Mock complexe avec plusieurs tables
const builder = new SupabaseMockBuilder()
  .forTable("interventions", {
    data: [{ id: "1", statut: "EN_COURS" }],
    error: null,
  })
  .forTable("artisans", {
    data: [{ id: "2", nom: "Dupont" }],
    error: null,
  })
  .forRpc("get_intervention_history", {
    data: [{ action: "UPDATE" }],
    error: null,
  })
  .withDefaultResult({ data: [], error: null })
  .build()

vi.mocked(supabase.from).mockImplementation(builder.from)
vi.mocked(supabase.rpc).mockImplementation(builder.rpc)
```

Le builder simule les appels chaines de Supabase :

```typescript
// Ce code de production...
const { data } = await supabase
  .from("interventions")
  .select("*")
  .eq("statut_id", statusId)
  .order("created_at", { ascending: false })

// ...est mocke par le builder qui gere .select().eq().order() automatiquement
```

---

## 5. Fixtures

### Factory pattern pour les donnees de test

```typescript
// tests/__fixtures__/interventions.ts
import type { InterventionView } from "@/types/intervention-view"

export const createMockIntervention = (
  overrides: Partial<InterventionView> = {}
): InterventionView => ({
  id: "test-intervention-1",
  idIntervention: "INT-001",
  statut: "En cours",
  statutCode: "EN_COURS",
  nomClient: "Client Test",
  telephoneClient: "0601020304",
  adresse: "123 Rue Test",
  ville: "Paris",
  codePostal: "75001",
  dateIntervention: new Date().toISOString(),
  coutIntervention: 500,
  marge: 150,
  lat: 48.8566,
  lng: 2.3522,
  ...overrides,
})

// Collection de fixtures
export const mockInterventions: InterventionView[] = [
  createMockIntervention({ id: "1", statut: "Nouvelle demande" }),
  createMockIntervention({ id: "2", statut: "En cours" }),
  createMockIntervention({ id: "3", statut: "Terminee" }),
]

// Interventions par statut pour tests de workflow
export const mockInterventionsByStatus = {
  nouvelle: createMockIntervention({ statut: "Nouvelle demande", statutCode: "NOUVELLE" }),
  enCours: createMockIntervention({ statut: "En cours", statutCode: "EN_COURS" }),
  terminee: createMockIntervention({ statut: "Terminee", statutCode: "TERMINEE" }),
  annulee: createMockIntervention({ statut: "Annulee", statutCode: "ANNULEE" }),
}
```

Utilisation dans les tests :

```typescript
import { createMockIntervention, mockInterventionsByStatus } from "tests/__fixtures__/interventions"

it("should handle intervention with custom data", () => {
  const intervention = createMockIntervention({
    coutIntervention: 1500,
    marge: 450,
  })
  // ...
})
```

---

## 6. Tests d'integration

Les tests d'integration verifient l'interaction entre plusieurs modules.

```typescript
// tests/integration/realtime-sync.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

describe("Realtime Cache Sync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should update cache when realtime INSERT event arrives", async () => {
    // Setup : simuler un etat de cache TanStack Query
    // Act : declencher un evenement realtime
    // Assert : verifier que le cache a ete mis a jour
  })

  it("should handle conflict detection on concurrent edits", async () => {
    // Simuler deux modifications < 5s d'intervalle
    // Verifier la detection de conflit
  })
})
```

---

## 7. Tests E2E (Playwright)

### Configuration (`playwright.config.ts`)

```typescript
import { defineConfig } from "@playwright/test"

export default defineConfig({
  use: {
    headless: true,
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
})
```

### Ecrire un test E2E

```typescript
// tests/e2e/my-feature.playwright.ts
import { test, expect } from "@playwright/test"

test.describe("Ma Feature E2E", () => {
  test("should display the page correctly", async ({ page }) => {
    await page.goto("/my-page")
    await expect(page.locator("h1")).toContainText("Mon titre")
  })

  test("should navigate and interact", async ({ page }) => {
    await page.goto("/interventions")
    await expect(page.locator("text=Interventions")).toBeVisible()

    // Interaction
    await page.keyboard.press("ArrowRight")
    await expect(page.locator("text=Trier par:")).toBeVisible()
  })
})
```

### Lancer les tests E2E

```bash
# Lancer tous les tests E2E
npx playwright test tests/e2e/

# Lancer un test specifique
npx playwright test tests/e2e/interventions.playwright.ts

# Mode interactif (avec navigateur visible)
npx playwright test --headed

# Generer le rapport HTML
npx playwright show-report
```

---

## 8. Commandes

```bash
# Lancer tous les tests unitaires
npm run test

# Mode watch (relance a chaque modification)
npm run test:watch

# Avec couverture de code
npx vitest --coverage

# Lancer un fichier specifique
npx vitest tests/unit/lib/margin-calculator.test.ts

# Lancer les tests matchant un pattern
npx vitest --grep "margin"

# Tests E2E (necessite le serveur de dev)
npx playwright test
```

---

## 9. Bonnes pratiques

### Structure Arrange-Act-Assert

```typescript
it("should calculate margin correctly", () => {
  // Arrange : preparer les donnees
  const revenue = 1000
  const costSST = 600
  const costMaterial = 100

  // Act : executer la fonction
  const result = calculatePrimaryArtisanMargin(revenue, costSST, costMaterial)

  // Assert : verifier le resultat
  expect(result.marginPercentage).toBe(30)
  expect(result.isValid).toBe(true)
})
```

### Tester les cas limites

Toujours tester : valeurs nulles, chaines vides, nombres negatifs, NaN, tableaux vides.

```typescript
it("should handle NaN inputs as 0", () => {
  const result = calculatePrimaryArtisanMargin("invalid", "bad", "data")
  expect(result.isValid).toBe(false)
  expect(result.revenue).toBe(0)
})
```

### Isolation des tests

- Utiliser `beforeEach(() => vi.clearAllMocks())` pour reset les mocks
- Chaque test doit etre independant (pas de dependance a l'ordre d'execution)
- Utiliser des donnees fraiches par test (via factories comme `createMockIntervention`)

### Nommage

```typescript
// Bon : decrit le comportement attendu
it("should return invalid for zero revenue")
it("should throw when artisan is required but missing")

// Mauvais : decrit l'implementation
it("calls calculateMargin function")
it("uses try-catch block")
```

### Quand utiliser quel type de test

| Situation | Type de test |
|-----------|-------------|
| Fonction pure (calculs, transformations) | Unitaire |
| Hook custom avec TanStack Query | Unitaire avec wrapper |
| Interaction entre cache et realtime | Integration |
| Workflow utilisateur complet | E2E |
| Apparence visuelle d'un composant | Visual (Playwright) |
