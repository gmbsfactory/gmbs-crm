# Conventions de nommage des fichiers

> Règles de nommage et d'organisation des fichiers dans GMBS-CRM.

---

## Conventions par type de fichier

### Composants React

| Convention | Exemple |
|------------|---------|
| PascalCase pour les composants | `InterventionCard.tsx`, `StatusBadge.tsx` |
| kebab-case pour les composants shadcn/ui | `button.tsx`, `scroll-area.tsx`, `hover-card.tsx` |
| Dossier pour les composants complexes | `intervention-modal/`, `artisan-modal/` |
| `index.ts` dans les dossiers composants | Re-exports du dossier |

```
src/components/
  ui/
    button.tsx                    # shadcn/ui (kebab-case)
    scroll-area.tsx
    intervention-modal/           # Composant complexe (dossier)
      InterventionModal.tsx       # Composant principal (PascalCase)
      InterventionModalContent.tsx
      index.ts                    # Re-exports
  interventions/
    InterventionCard.tsx          # Composant métier (PascalCase)
    InterventionForm.tsx
    ConnectionStatusIndicator.tsx
```

### Hooks

| Convention | Exemple |
|------------|---------|
| camelCase avec préfixe `use` | `useInterventionsQuery.ts`, `useModal.ts` |
| Un hook par fichier | `useDebounce.ts`, `usePagination.ts` |

```
src/hooks/
  useInterventionsQuery.ts
  useArtisansQuery.ts
  usePermissions.ts
  useModal.ts
  use-toast.ts                    # Exception shadcn/ui
```

### Modules API et librairies

| Convention | Exemple |
|------------|---------|
| camelCase pour les modules API | `interventionsApi.ts`, `artisansApi.ts` |
| kebab-case pour les utilitaires | `cache-sync.ts`, `error-handler.ts` |
| kebab-case pour les fichiers config | `workflow-rules.ts`, `status-colors.ts` |

```
src/lib/api/v2/
  interventionsApi.ts             # Module API (camelCase)
  artisansApi.ts
  common/
    cache.ts                      # Utilitaire (kebab-case)
    error-handler.ts
    utils.ts

src/lib/realtime/
  realtime-client.ts              # kebab-case
  cache-sync.ts
  broadcast-sync.ts
  sync-queue.ts
```

### Types

| Convention | Exemple |
|------------|---------|
| kebab-case | `interventions.ts`, `intervention-views.ts` |
| Descriptif du contenu | `property-schema.ts`, `modal-display.ts` |

```
src/types/
  interventions.ts
  intervention-generated.ts
  intervention-views.ts
  intervention-workflow.ts
  property-schema.ts
  modal.ts
  modal-display.ts
  search.ts
  artisan-page.ts
  context-menu.ts
```

### Pages Next.js (App Router)

| Convention | Exemple |
|------------|---------|
| `page.tsx` | Point d'entrée de la route |
| `layout.tsx` | Layout de la route |
| `[param]` | Segment dynamique |
| `_components/` | Composants co-localisés (non routés) |
| `_lib/` | Logique co-localisée (non routée) |

```
app/
  interventions/
    page.tsx                      # /interventions
    layout.tsx                    # Layout interventions
    [id]/
      page.tsx                    # /interventions/[id]
    new/
      page.tsx                    # /interventions/new
    _components/                  # Non routé (préfixe _)
      InterventionsPlusMenu.tsx
      InterventionsStatusFilter.tsx
    _lib/
      useInterventionPageState.ts
```

### Tests

| Convention | Exemple |
|------------|---------|
| Même nom que le source + `.test.ts` | `cache.test.ts`, `workflow-engine.test.ts` |
| Structure miroir de `src/` | `tests/unit/lib/interventions/` |

```
tests/
  unit/
    lib/
      interventions/
        interventions-crud.test.ts
        interventions-status.test.ts
      workflow/
        cumulative-validation.test.ts
    hooks/
      useInterventionFormState.test.ts
    components/
      TruncatedCell.test.tsx
```

### Migrations SQL

| Convention | Exemple |
|------------|---------|
| `NNNNN_description.sql` | `00041_rls_core_tables.sql` |
| Numéro a 5 chiffres | Incrémenté séquentiellement |
| snake_case pour la description | `add_avatar_url`, `fix_artisan_status` |

### Edge Functions (Deno)

| Convention | Exemple |
|------------|---------|
| kebab-case pour le dossier | `interventions-v2/`, `check-inactive-users/` |
| `index.ts` comme point d'entrée | `supabase/functions/interventions-v2/index.ts` |
| `_shared/` pour le code partagé | `supabase/functions/_shared/cors.ts` |

---

## Co-location

### Principe

Les fichiers sont placés au plus près de leur utilisation. Le projet suit deux niveaux de co-location :

1. **Co-location Next.js** : composants et logique dans les dossiers `_components/` et `_lib/` des routes
2. **Co-location par domaine** : composants dans `src/components/interventions/`, `src/components/artisans/`, etc.

### Quand utiliser quoi

| Situation | Emplacement |
|-----------|------------|
| Composant utilisé par une seule page | `app/[page]/_components/` |
| Composant utilisé par plusieurs pages du même domaine | `src/components/[domaine]/` |
| Composant réutilisable cross-domaine | `src/components/shared/` |
| Composant UI de base | `src/components/ui/` |
| Hook spécifique a une page | `app/[page]/_lib/` |
| Hook réutilisable | `src/hooks/` |
| Logique métier | `src/lib/` |

---

## Imports

### Ordre des imports (convention non enforcée mais respectée)

```typescript
// 1. React et bibliothèques
import React, { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

// 2. Composants UI
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// 3. Composants métier
import { InterventionCard } from "@/components/interventions/InterventionCard"

// 4. Hooks
import { usePermissions } from "@/hooks/usePermissions"

// 5. Lib et utilitaires
import { interventionsApi } from "@/lib/api/v2"
import { cn } from "@/lib/utils"

// 6. Types
import type { Intervention } from "@/lib/api/v2/common/types"
```

### Alias obligatoire

Tous les imports cross-feature doivent utiliser l'alias `@/` :

```typescript
// Correct
import { Button } from "@/components/ui/button"

// Interdit (ESLint error)
import { Button } from "../../../components/ui/button"
import { Button } from "@/src/components/ui/button"
```
