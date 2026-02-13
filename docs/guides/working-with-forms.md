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

Le projet utilise `useInterventionForm` (`src/hooks/useInterventionForm.ts`) comme reference. Voici le pattern :

### Structure du hook

```typescript
// src/hooks/useInterventionForm.ts (simplifie)
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CreateInterventionSchema, UpdateInterventionSchema } from "@/types/interventions"

type UseInterventionFormParams = {
  mode: "create" | "edit"
  interventionId?: string
  defaultValues?: Partial<CreateInterventionInput & UpdateInterventionInput>
  onSuccess?: (payload: unknown) => void
}

export function useInterventionForm({
  mode,
  interventionId,
  defaultValues,
  onSuccess,
}: UseInterventionFormParams) {
  // 1. Choisir le schema selon le mode
  const resolver = useMemo(
    () => mode === "create"
      ? zodResolver(CreateInterventionSchema)
      : zodResolver(UpdateInterventionSchema),
    [mode]
  )

  // 2. Initialiser React Hook Form
  const form = useForm({
    resolver,
    defaultValues: {
      status: "POTENTIEL",
      ...defaultValues,
    },
  })

  // 3. Logique de soumission
  const onSubmit = useCallback(async (data) => {
    if (mode === "create") {
      // Verifier les doublons avant creation
      const duplicates = await checkDuplicates(data.address)
      if (duplicates.length > 0) {
        // Demander confirmation
        return
      }
      const result = await createIntervention(data)
      onSuccess?.(result)
    } else {
      const result = await updateIntervention(interventionId!, data)
      onSuccess?.(result)
    }
  }, [mode, interventionId, onSuccess])

  return {
    form,               // Instance React Hook Form
    onSubmit,           // Handler de soumission
    isSubmitting: form.formState.isSubmitting,
    errors: form.formState.errors,
  }
}
```

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

Pour les formulaires complexes (comme le formulaire d'intervention), le projet separe la logique de formulaire en deux hooks :

- `useInterventionForm` : Gestion React Hook Form + validation + soumission
- `useInterventionFormState` : Etat UI (geocodage, artisans proches, sections collapsibles, changements non sauvegardes)

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

Le hook `useInterventionForm` verifie les doublons avant la creation :

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

Certains statuts d'intervention exigent des champs specifiques :

```typescript
const REQUIRES_ARTISAN_STATUSES = [
  "VISITE_TECHNIQUE", "INTER_EN_COURS", "INTER_TERMINEE", "ATT_ACOMPTE",
]

const ensureBusinessRules = (status?: string, artisanId?: string | null) => {
  if (status && REQUIRES_ARTISAN_STATUSES.includes(status) && !artisanId) {
    throw new Error("Un artisan assigne est requis pour ce statut")
  }
}
```

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
