# Standards de code

> Conventions de codage TypeScript, React et CSS/Tailwind pour GMBS-CRM.

---

## TypeScript

### Configuration

Le projet utilise TypeScript en mode strict. Configuration dans `tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "downlevelIteration": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Points importants :**
- `strict: true` : active toutes les vérifications strictes (noImplicitAny, strictNullChecks, etc.)
- `moduleResolution: "bundler"` : résolution de modules adaptée a Next.js
- Alias `@/*` : tous les imports internes passent par `@/` (mappe vers `./src/`)

### Règles TypeScript

| Règle | Convention |
|-------|-----------|
| `any` | Interdit sauf cas exceptionnels documentés |
| Interfaces | Pour les props de composants |
| Types | Pour les unions et types utilitaires |
| Enums | Éviter. Préférer les unions littérales ou `as const` |
| Assertions de type | Éviter `as`. Préférer le narrowing |
| Non-null assertion | Éviter `!`. Utiliser des guards |

### Exemples

```typescript
// Props de composant : interface
interface InterventionCardProps {
  intervention: Intervention
  onClick?: (id: string) => void
  isSelected?: boolean
}

// Union de types : type
type ViewLayout = "table" | "cards" | "gallery" | "kanban" | "calendar" | "timeline"

// Constantes typées : as const
const InterventionStatusValues = [
  "DEMANDE", "DEVIS_ENVOYE", "VISITE_TECHNIQUE",
  "REFUSE", "ANNULE", "STAND_BY",
  "ACCEPTE", "INTER_EN_COURS", "INTER_TERMINEE",
  "SAV", "ATT_ACOMPTE", "POTENTIEL"
] as const
```

### Types générés

Les types Supabase sont générés automatiquement :

```bash
npm run types:generate
# Produit : src/lib/database.types.ts
```

Les types métier enrichis se trouvent dans `src/types/` (11 fichiers).

---

## React

### Composants

| Convention | Détail |
|------------|--------|
| Type de composant | Functional components uniquement (pas de classes) |
| Export | Named exports (pas de default export sauf pour les pages Next.js) |
| Props | Destructurées avec types explicites |
| État | Hooks (useState, useReducer) |
| Effets | useEffect avec cleanup |
| Mémo | React.memo uniquement si mesure de perf le justifie |
| Refs | useRef pour DOM et valeurs stables |

### Exemples

```tsx
// Composant standard
interface StatusBadgeProps {
  status: string
  color: string
}

export function StatusBadge({ status, color }: StatusBadgeProps) {
  return (
    <span className={cn("rounded-full px-2 py-1 text-xs", color)}>
      {status}
    </span>
  )
}
```

### Hooks custom

| Convention | Détail |
|------------|--------|
| Nommage | `use` + PascalCase (useInterventionsQuery) |
| Emplacement | `src/hooks/` pour les hooks globaux |
| Co-location | `app/*/_lib/` pour les hooks page-specific |
| Retour | Objet nommé pour plus de 2 valeurs de retour |
| Dépendances | Utiliser les factories de query keys |

### Directive "use client"

Ajouter `"use client"` en haut des fichiers contenant :
- `useState`, `useEffect`, `useRef` et autres hooks React
- Event handlers (`onClick`, `onChange`, etc.)
- APIs navigateur (`window`, `document`, `localStorage`)

---

## ESLint

### Configuration

Le projet utilise ESLint 9+ avec la flat config (`eslint.config.js`) :

```javascript
module.exports = [
  {
    ignores: [
      "**/node_modules/**", ".next/**", "dist/**",
      "out/**", "build/**", "coverage/**", "scripts/**",
    ],
  },
  ...compat.config({
    extends: ["next/core-web-vitals"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/src/*"],
            message: "N'utilise jamais @/src - utilise @/ direct.",
          },
          {
            group: ["../*", "../../*", "../../../*"],
            message: "Utilise l'alias @/ pour les imports cross-feature.",
          },
        ],
      }],
    },
  }),
  // Exception pour tests, examples, edge functions
  {
    files: ["examples/**/*", "tests/**/*", "supabase/functions/**/*"],
    rules: { "no-restricted-imports": "off" },
  },
]
```

### Règles d'import

| Règle | Détail |
|-------|--------|
| Import alias | Toujours utiliser `@/` pour les imports cross-feature |
| Import relatif `../` | Interdit entre features. OK dans le même dossier (`./`) |
| `@/src/*` | Interdit (redondant, utiliser `@/` directement) |

```typescript
// Correct
import { Button } from "@/components/ui/button"
import { interventionsApi } from "@/lib/api/v2"

// Incorrect
import { Button } from "../../components/ui/button"
import { interventionsApi } from "@/src/lib/api/v2"
```

---

## CSS / Tailwind

### Configuration Tailwind

Le projet utilise Tailwind CSS 3.4 avec les paramètres suivants (`tailwind.config.ts`) :

- **Dark mode :** `"class"` (basculé via next-themes)
- **Plugin :** `tailwindcss-animate` pour les animations
- **Variables CSS :** Les couleurs utilisent des variables CSS HSL (`hsl(var(--primary))`)

### Couleurs sémantiques

Les couleurs du design system sont définies via des CSS custom properties :

| Token | Usage |
|-------|-------|
| `background` / `foreground` | Fond et texte principal |
| `primary` / `secondary` | Actions principales et secondaires |
| `muted` | Texte et fonds atténués |
| `accent` | Mise en avant |
| `destructive` | Actions destructives (supprimer, etc.) |
| `border` / `input` / `ring` | Bordures et focus |
| `card` / `popover` | Conteneurs |
| `sidebar-*` | Tokens spécifiques a la sidebar |
| `status-*` | Couleurs des statuts d'intervention (11 variantes) |
| `gold` / `silver` / `bronze` | Podium classement gestionnaires |

### Utilitaires CSS

La fonction `cn()` combine `clsx` et `tailwind-merge` pour la fusion de classes :

```typescript
import { cn } from "@/lib/utils"

<div className={cn(
  "rounded-lg border p-4",
  isActive && "bg-primary text-primary-foreground",
  className
)} />
```

### Animations personnalisées

| Animation | Description | Durée |
|-----------|-------------|-------|
| `accordion-down` / `accordion-up` | Ouverture/fermeture accordéon | 0.2s |
| `slide-in-right` | Glissement modal halfpage | - |
| `fade-in` | Apparition en fondu | - |
| `scale-in` | Apparition avec zoom | - |
| `fullscreen-expand` | Expansion plein écran | - |
| `caret-blink` | Clignotement curseur OTP | 1.25s |

---

## Validation des données

### Zod

Les schémas de validation utilisent Zod :

```typescript
import { z } from "zod"

const CreateInterventionSchema = z.object({
  agence_id: z.string().uuid(),
  metier_id: z.string().uuid(),
  adresse: z.string().min(1, "L'adresse est obligatoire"),
  contexte_intervention: z.string().min(1, "Le contexte est obligatoire"),
  date: z.string().datetime(),
  statut_id: z.string().uuid(),
})
```

### React Hook Form + Zod

```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

const form = useForm({
  resolver: zodResolver(CreateInterventionSchema),
  defaultValues: { ... },
})
```

---

## Vérification

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript compiler (tsc --noEmit)
```

Ces deux commandes sont exécutées en CI sur chaque PR (voir `.github/workflows/ci.yml`).
