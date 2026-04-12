# Travailler avec les formulaires

Guide pour creer et gerer des formulaires dans GMBS-CRM avec React Hook Form, Zod et les patterns du projet.

---

## Table des matieres

1. [Stack formulaire](#1-stack-formulaire)
2. [Schema de validation Zod](#2-schema-de-validation-zod)
3. [Hook de formulaire](#3-hook-de-formulaire)
4. [Hook d'etat formulaire](#4-hook-detat-formulaire)
5. [Composants de formulaire](#5-composants-de-formulaire)
6. [Patterns avances](#6-patterns-avances)
7. [Tests](#7-tests)

---

## 1. Stack formulaire

| Librairie | Role |
|-----------|------|
| **React Hook Form 7.54** | Gestion d'etat formulaire, performance |
| **Zod 3.24** | Validation de schema, inference de types |
| **@hookform/resolvers** | Pont entre React Hook Form et Zod |

---

## 2. Schema de validation Zod

Les schemas sont definis dans `src/types/interventions.ts` et servent a la fois de validation et de generation de types TypeScript.

### Creer un schema

```typescript
// src/types/my-entity.ts
import { z } from "zod"

// Schema de creation
export const CreateEntitySchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  amount: z.number().min(0, "Le montant doit etre positif"),
  notes: z.string().max(500).optional(),
})

// Schema de mise a jour (tous les champs optionnels)
export const UpdateEntitySchema = CreateEntitySchema.partial()

// Types inferes automatiquement
export type CreateEntityInput = z.infer<typeof CreateEntitySchema>
export type UpdateEntityInput = z.infer<typeof UpdateEntitySchema>
```

### Schemas existants pour les interventions

Le projet definit des schemas pour les interventions dans `src/types/interventions.ts` :

```typescript
// Statuts possibles
const InterventionStatusValues = [
  "DEMANDE", "DEVIS_ENVOYE", "VISITE_TECHNIQUE", "REFUSE", "ANNULE",
  "STAND_BY", "ACCEPTE", "INTER_EN_COURS", "INTER_TERMINEE", "SAV",
  "ATT_ACOMPTE", "POTENTIEL",
]

// Schemas : CreateInterventionSchema, UpdateInterventionSchema,
// DuplicateCheckSchema, InvoiceLookupSchema
```

---

## 3. Hook de formulaire

> **Refacto avril 2026** : le hook historique `useInterventionForm` a été supprimé. Le formulaire d'intervention est désormais piloté par **trois hooks complémentaires** :
> - `useInterventionFormState` — état partagé (valeurs, dirty, géocodage, brouillon Zustand, sélection artisan)
> - `useInterventionSubmit` — pipeline de soumission (mutation, owner/tenant find-or-create, post-mutation tasks)
> - `useInterventionValidation` — calcul dynamique des champs requis selon le statut sélectionné
>
> Si vous ajoutez une nouvelle saisie au formulaire d'intervention, **étendre ces hooks** plutôt que créer un hook concurrent. Pour vos propres entités, suivez le même découpage : **état** / **submit** / **validation**.

Pour une entité simple, un hook unique reste acceptable. Voici le pattern de référence :

### Pattern actuel — formulaire d'intervention

```typescript
// Composant : NewInterventionForm.tsx ou InterventionEditForm.tsx
import { useInterventionFormState } from "@/hooks/useInterventionFormState"
import { useInterventionSubmit } from "@/hooks/useInterventionSubmit"
import { useInterventionValidation } from "@/hooks/useInterventionValidation"

function NewInterventionForm({ onSuccess }: Props) {
  // 1. État partagé (valeurs, dirty, géocodage, brouillon, sélection artisan…)
  const state = useInterventionFormState({ mode: "create" })

  // 2. Champs requis dynamiques selon le statut sélectionné
  const validation = useInterventionValidation({
    status: state.formData.statut,
  })

  // 3. Pipeline de soumission (owner/tenant find-or-create, post-mutation tasks…)
  const { submit, isSubmitting } = useInterventionSubmit({
    interventionId: "",            // vide en mode create
    formData: state.formData,
    currentUser: state.currentUser,
    selectedArtisanId: state.selectedArtisanId,
    // …
    onSuccess,
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }}>
      <InterventionHeaderFields state={state} validation={validation} />
      <InterventionClientSection state={state} validation={validation} />
      {/* …autres sections issues de form-sections/ */}
    </form>
  )
}
```

> Les sections (`InterventionHeaderFields`, `InterventionClientSection`, etc.) sont importées depuis `@/components/interventions/form-sections`. Voir [intervention-components.md](../components/intervention-components.md#sections-de-formulaire-form-sections) pour la liste complète et la règle de composition.

### Creer votre propre hook de formulaire

```typescript
// src/hooks/useMyEntityForm.ts
import { useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  CreateEntitySchema,
  UpdateEntitySchema,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/types/my-entity"

type UseMyEntityFormParams = {
  mode: "create" | "edit"
  entityId?: string
  defaultValues?: Partial<CreateEntityInput>
  onSuccess?: () => void
}

export function useMyEntityForm({
  mode,
  entityId,
  defaultValues,
  onSuccess,
}: UseMyEntityFormParams) {
  const resolver = useMemo(
    () => mode === "create"
      ? zodResolver(CreateEntitySchema)
      : zodResolver(UpdateEntitySchema),
    [mode]
  )

  const form = useForm<CreateEntityInput>({
    resolver,
    defaultValues: {
      status: "active",
      ...defaultValues,
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (mode === "create") {
        await myApi.create(data)
      } else {
        await myApi.update(entityId!, data)
      }
      onSuccess?.()
    } catch (error) {
      // Gerer l'erreur (toast, etc.)
      console.error(error)
    }
  })

  return {
    form,
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    isDirty: form.formState.isDirty,
    errors: form.formState.errors,
  }
}
```

---

## 4. Hook d'etat formulaire

Pour les formulaires complexes (comme le formulaire d'intervention), le projet sépare la logique en **trois** hooks :

- `useInterventionFormState` : valeurs des champs, dirty tracking, géocodage, artisans proches, sections collapsibles, brouillon Zustand (`useInterventionDraftStore`), sélection artisan
- `useInterventionSubmit` : pipeline de soumission (mutation principale, find-or-create owner/tenant, `runPostMutationTasks`, gestion d'erreur avec toast)
- `useInterventionValidation` : calcule à partir de `form-constants.ts` quels champs sont requis selon le statut sélectionné

> ⚠️ Toute règle "ce champ devient requis quand le statut passe à X" doit être déclarée dans `src/lib/interventions/form-constants.ts` (ex: `STATUSES_REQUIRING_DATE_PREVUE`) et consommée via `useInterventionValidation`. Ne pas la coder en dur dans un composant.

### `useInterventionFormState` (simplifie)

```typescript
// src/hooks/useInterventionFormState.ts
export function useInterventionFormState(options: UseInterventionFormStateOptions) {
  const { mode, initialFormData } = options

  // Donnees de reference (statuts, agences, users)
  const { data: refData } = useReferenceData()
  const { data: currentUser } = useCurrentUser()

  // Geocodage : autocompletion d'adresse
  const {
    query: locationQuery,
    setQuery: setLocationQuery,
    suggestions,
    geocode,
  } = useGeocodeSearch({ debounceMs: 300 })

  // Artisans proches de l'adresse selectionnee
  const { artisans: nearbyArtisans } = useNearbyArtisans({
    lat: selectedLat,
    lng: selectedLng,
    radiusKm: 50,
  })

  // Detection de changements non sauvegardes
  const { hasChanges } = useFormDataChanges(initialFormData, currentFormData)

  // Calcul de marge en temps reel
  const margin = useMemo(() => {
    return calculatePrimaryArtisanMargin(
      formData.cout_intervention,
      formData.cout_sst,
      formData.cout_materiel
    )
  }, [formData.cout_intervention, formData.cout_sst, formData.cout_materiel])

  return {
    refData,
    currentUser,
    locationQuery,
    setLocationQuery,
    suggestions,
    nearbyArtisans,
    hasChanges,
    margin,
    // ... et beaucoup d'autres valeurs
  }
}
```

---

## 5. Composants de formulaire

### Composants shadcn/ui disponibles

Le projet utilise les composants `shadcn/ui` dans `src/components/ui/` :

- `Input` - Champ texte
- `Textarea` - Zone de texte
- `Select` / `MultiSelect` - Menus deroulants
- `Checkbox` / `Switch` - Cases a cocher
- `DatePicker` / `Calendar` - Selection de dates
- `Label` - Labels de champ
- `Button` - Boutons d'action

### Pattern de formulaire

```tsx
"use client"

import { useMyEntityForm } from "@/hooks/useMyEntityForm"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function MyEntityForm({ mode, entityId, defaultValues, onClose }) {
  const { form, onSubmit, isSubmitting, errors } = useMyEntityForm({
    mode,
    entityId,
    defaultValues,
    onSuccess: onClose,
  })

  const { register, setValue, watch } = form

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Champ texte simple */}
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Nom de l'entite"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Champ email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Select (necessite setValue car non-natif) */}
      <div className="space-y-2">
        <Label>Statut</Label>
        <Select
          value={watch("status")}
          onValueChange={(value) => setValue("status", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choisir un statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="inactive">Inactif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Boutons */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement..." : mode === "create" ? "Creer" : "Enregistrer"}
        </Button>
      </div>
    </form>
  )
}
```

---

## 6. Patterns avances

### Detection de doublons (avant creation)

`useInterventionFormState` expose la detection de doublons pour la creation. Le pattern sous-jacent :

```typescript
const checkDuplicates = useCallback(async (address: string, agencyId: string) => {
  const { data } = await supabase
    .from("interventions")
    .select("id, adresse, agence_id")
    .ilike("adresse", `%${address}%`)
    .eq("agence_id", agencyId)
    .limit(5)

  return data || []
}, [])
```

### Regles metier conditionnelles

Certains statuts d'intervention exigent des champs specifiques. Ces règles sont **centralisées** dans `src/lib/interventions/form-constants.ts` sous forme de listes :

```typescript
// src/lib/interventions/form-constants.ts
export const ARTISAN_REQUIRED_STATUS_CODES = [
  "VISITE_TECHNIQUE", "INTER_EN_COURS", "INTER_TERMINEE", "ATT_ACOMPTE",
]
export const STATUSES_REQUIRING_DATE_PREVUE = [/* … */]
export const STATUSES_REQUIRING_NOM_FACTURATION = [/* … */]
// etc.
```

Et consommées via `useInterventionValidation` :

```typescript
const validation = useInterventionValidation({ status: formData.statut })
// validation.requiresArtisan, validation.requiresDatePrevue, …
```

> **Règle :** ne **jamais** dupliquer ces listes dans un composant ou un autre hook. Pour ajouter une règle, étendre `form-constants.ts` puis exposer le flag dans `useInterventionValidation`. Les fonctions de dérivation pures (calculs annexes basés sur ces règles) vont dans `src/lib/interventions/derivations.ts`.

### Changements non sauvegardes

Le hook `useFormDataChanges` detecte les modifications par comparaison profonde :

```typescript
import { useFormDataChanges } from "@/hooks/useFormDataChanges"

const { hasChanges } = useFormDataChanges(initialData, currentData)

// Utilise dans GenericModal pour afficher un avertissement
// avant de fermer si des changements ne sont pas sauvegardes
```

Le hook `useUnsavedChanges` ajoute un listener `beforeunload` pour bloquer la navigation :

```typescript
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"

useUnsavedChanges(hasChanges) // Affiche un dialog natif si l'utilisateur tente de quitter
```

### Geocodage dans le formulaire

L'autocompletion d'adresse est geree par `useGeocodeSearch` :

```typescript
const { query, setQuery, suggestions, geocode } = useGeocodeSearch({
  minQueryLength: 3,
  debounceMs: 300,
})

// Quand l'utilisateur tape une adresse :
// 1. Debounce 300ms
// 2. Appel /api/geocode?q=...&suggest=1
// 3. Affichage des suggestions
// 4. Selection -> coordonnees lat/lng remplies automatiquement
```

---

## 7. Tests

### Tester un schema Zod

```typescript
import { describe, it, expect } from "vitest"
import { CreateEntitySchema } from "@/types/my-entity"

describe("CreateEntitySchema", () => {
  it("should validate correct input", () => {
    const result = CreateEntitySchema.safeParse({
      name: "Test",
      amount: 100,
    })
    expect(result.success).toBe(true)
  })

  it("should reject empty name", () => {
    const result = CreateEntitySchema.safeParse({
      name: "",
      amount: 100,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Le nom est requis")
  })

  it("should reject negative amount", () => {
    const result = CreateEntitySchema.safeParse({
      name: "Test",
      amount: -1,
    })
    expect(result.success).toBe(false)
  })
})
```

### Tester les regles metier

```typescript
import { describe, it, expect } from "vitest"

describe("ensureBusinessRules", () => {
  it("should throw when artisan is required but missing", () => {
    expect(() =>
      ensureBusinessRules("INTER_EN_COURS", null)
    ).toThrow("Un artisan assigne est requis pour ce statut")
  })

  it("should not throw when artisan is provided", () => {
    expect(() =>
      ensureBusinessRules("INTER_EN_COURS", "artisan-id")
    ).not.toThrow()
  })

  it("should not throw for statuses that dont require artisan", () => {
    expect(() =>
      ensureBusinessRules("DEMANDE", null)
    ).not.toThrow()
  })
})
```
