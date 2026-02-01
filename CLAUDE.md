# CLAUDE.md - Conventions de développement GMBS-CRM

## Contexte du projet

CRM pour la gestion des interventions, artisans et clients.
- **Stack** : Next.js 15, React 18, TypeScript 5, Supabase, TanStack Query, Tailwind CSS
- **Tests** : Vitest + React Testing Library + Playwright (E2E)

---

## Politique de Tests

### Règle fondamentale

**Toute nouvelle feature ou modification de code existant DOIT inclure des tests.**

### Structure des tests

```
tests/
├── unit/                    # Tests unitaires
│   ├── hooks/              # Tests des hooks custom
│   ├── lib/                # Tests des utilitaires/API
│   └── components/         # Tests des composants avec logique
├── integration/            # Tests d'intégration
└── e2e/                    # Tests end-to-end (Playwright)
```

### Quoi tester obligatoirement

| Priorité | Type | Couverture attendue |
|----------|------|---------------------|
| Critique | Workflow/transitions de statuts | 100% |
| Critique | Calculs métier (marge, coûts) | 100% |
| Haute | Hooks custom (useInterventionsQuery, etc.) | 80%+ |
| Haute | Fonctions API (interventionsApi.ts) | 80%+ |
| Moyenne | Composants avec logique conditionnelle | 60%+ |
| Basse | Composants UI simples | Optionnel |

### Conventions de nommage

- Fichier test : `<fichier-source>.test.ts` ou `.spec.ts`
- Structure : `describe('NomDuModule')` → `it('should <comportement attendu>')`
- Un fichier test par fichier source

### Workflow de développement (TDD encouragé)

Quand on implémente une feature :
1. **D'abord les tests** - Écrire les tests qui décrivent le comportement attendu
2. **Ensuite le code** - Implémenter jusqu'à ce que les tests passent
3. **Vérification** - `npm run test` doit passer sans régression

### Template de test

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

### Mocks

- Mocks Supabase : `tests/__mocks__/supabase.ts`
- Mocks données : `tests/__fixtures__/`
- Utiliser `vi.mock()` pour les dépendances externes

### Avant de valider une feature

- [ ] Tests unitaires écrits pour la nouvelle logique
- [ ] Tests passent localement (`npm run test`)
- [ ] Pas de régression sur les tests existants
- [ ] Coverage n'a pas diminué

---

## Conventions de code

### TypeScript

- Strict mode activé
- Pas de `any` sauf cas exceptionnels documentés
- Interfaces pour les props, types pour les unions

### Composants React

- Functional components uniquement
- Hooks custom pour la logique réutilisable
- Props destructurées avec types explicites

### API & Data

- TanStack Query pour le cache client
- Supabase pour le backend
- Query keys centralisées dans `src/lib/react-query/queryKeys.ts`

### Git

- Commits conventionnels : `feat:`, `fix:`, `chore:`, `refactor:`, `test:`
- Messages en français ou anglais (cohérent par PR)
- Pas de fichiers sensibles (credentials, .env, données clients)

---

## Fichiers critiques à ne pas casser

Ces fichiers sont au coeur du système - toute modification nécessite des tests :

1. `src/lib/api/v2/interventionsApi.ts` - API principale
2. `src/lib/workflow/` - Transitions de statuts
3. `src/lib/realtime/cache-sync.ts` - Synchronisation cache
4. `src/hooks/useInterventionsQuery.ts` - Query principale
5. `supabase/functions/` - Edge functions

---

## Commandes utiles

```bash
npm run dev          # Serveur de développement
npm run build        # Build production
npm run test         # Lancer les tests
npm run test:watch   # Tests en mode watch
npm run lint         # Linter
npm run typecheck    # Vérification TypeScript
```
