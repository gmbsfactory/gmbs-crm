# Ajouter une feature

Guide pas-a-pas pour ajouter une fonctionnalite complete dans GMBS-CRM, en respectant les patterns existants.

---

## Table des matieres

1. [Vue d'ensemble du workflow](#1-vue-densemble-du-workflow)
2. [Etape 1 : Definir les types](#etape-1--definir-les-types)
3. [Etape 2 : Creer le module API](#etape-2--creer-le-module-api)
4. [Etape 3 : Definir les query keys](#etape-3--definir-les-query-keys)
5. [Etape 4 : Creer le hook custom](#etape-4--creer-le-hook-custom)
6. [Etape 5 : Creer le composant](#etape-5--creer-le-composant)
7. [Etape 6 : Ajouter la route / page](#etape-6--ajouter-la-route--page)
8. [Etape 7 : Ecrire les tests](#etape-7--ecrire-les-tests)
9. [Checklist finale](#checklist-finale)

---

## 1. Vue d'ensemble du workflow

Chaque feature suit cette architecture en couches :

```
Types (src/types/)
  -> Module API (src/lib/api/v2/)
    -> Query Keys (src/lib/react-query/queryKeys.ts)
      -> Hook custom (src/hooks/)
        -> Composant (src/components/ ou app/*/_components/)
          -> Page (app/*)
            -> Tests (tests/)
```

---

## Etape 1 : Definir les types

Creer ou etendre les types dans `src/types/`. Utiliser des interfaces pour les props et des types pour les unions.

```typescript
// src/types/reminders.ts
import { z } from "zod"

// Schema Zod pour la validation
export const CreateReminderSchema = z.object({
  intervention_id: z.string().uuid(),
  remind_at: z.string().datetime(),
  message: z.string().min(1).max(500),
})

export type CreateReminderInput = z.infer<typeof CreateReminderSchema>

// Type metier
export type Reminder = {
  id: string
  intervention_id: string
  user_id: string
  remind_at: string
  message: string
  is_read: boolean
  created_at: string
}
```

**Conventions :**
- Schemas Zod pour la validation des entrees (creation, mise a jour)
- Types TypeScript pour les reponses API et donnees metier
- Pas de `any` sauf cas exceptionnels documentes

---

## Etape 2 : Creer le module API

Ajouter le module dans `src/lib/api/v2/`. Chaque module suit le meme pattern facade.

```typescript
// src/lib/api/v2/remindersApi.ts
import type { Reminder, CreateReminderInput } from "@/types/reminders"
import { SUPABASE_FUNCTIONS_URL, getHeaders, handleResponse } from "./common/utils"
import { safeErrorMessage } from "./common/error-handler"

export const remindersApi = {
  async getMyReminders(): Promise<Reminder[]> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/reminders`,
      { headers: await getHeaders() }
    )
    return handleResponse(response)
  },

  async create(data: CreateReminderInput): Promise<Reminder> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/reminders`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    )
    return handleResponse(response)
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/reminders/${id}`,
      {
        method: "DELETE",
        headers: await getHeaders(),
      }
    )
    if (!response.ok) {
      throw new Error(safeErrorMessage(
        new Error(`Status ${response.status}`),
        "la suppression du rappel"
      ))
    }
  },
}
```

Puis enregistrer dans la facade principale :

```typescript
// src/lib/api/v2/index.ts
import { remindersApi } from "./reminders"

const apiV2 = {
  // ... modules existants
  reminders: remindersApi,
}
export default apiV2
```

**Pattern cle :** Utiliser `getHeaders()` pour obtenir automatiquement le bon token (session utilisateur en browser, service role en Node.js).

---

## Etape 3 : Definir les query keys

Ajouter les cles dans `src/lib/react-query/queryKeys.ts` en suivant le pattern factory existant :

```typescript
// src/lib/react-query/queryKeys.ts

export const reminderKeys = {
  all: ["reminders"] as const,
  lists: () => [...reminderKeys.all, "list"] as const,
  list: (params: { userId?: string }) => [...reminderKeys.lists(), params] as const,
  details: () => [...reminderKeys.all, "detail"] as const,
  detail: (id: string) => [...reminderKeys.details(), id] as const,
  invalidateAll: () => reminderKeys.all,
  invalidateLists: () => reminderKeys.lists(),
} as const
```

**Pourquoi c'est important :** Les query keys permettent l'invalidation ciblee du cache TanStack Query. Apres une creation, on invalide seulement les listes :

```typescript
queryClient.invalidateQueries({ queryKey: reminderKeys.invalidateLists() })
```

---

## Etape 4 : Creer le hook custom

Les hooks custom encapsulent la logique de data fetching et les mutations.

### Hook de query (lecture)

```typescript
// src/hooks/useReminders.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { reminderKeys } from "@/lib/react-query/queryKeys"
import { remindersApi } from "@/lib/api/v2"

export function useReminders() {
  return useQuery({
    queryKey: reminderKeys.lists(),
    queryFn: () => remindersApi.getMyReminders(),
    staleTime: 30_000,    // 30 secondes
    gcTime: 5 * 60_000,   // 5 minutes
  })
}
```

### Hook de mutation (ecriture)

```typescript
export function useCreateReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: remindersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reminderKeys.invalidateLists(),
      })
    },
  })
}
```

### Pattern d'update optimiste (pour les operations frequentes)

```typescript
export function useDeleteReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: remindersApi.delete,
    onMutate: async (deletedId) => {
      // Annuler les queries en cours
      await queryClient.cancelQueries({ queryKey: reminderKeys.lists() })

      // Sauvegarder l'etat precedent
      const previous = queryClient.getQueryData(reminderKeys.lists())

      // Mise a jour optimiste
      queryClient.setQueryData(reminderKeys.lists(), (old: Reminder[] | undefined) =>
        old?.filter((r) => r.id !== deletedId) ?? []
      )

      return { previous }
    },
    onError: (_error, _variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previous) {
        queryClient.setQueryData(reminderKeys.lists(), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.invalidateLists() })
    },
  })
}
```

---

## Etape 5 : Creer le composant

### Composant partage (cross-feature)

Placer dans `src/components/` :

```typescript
// src/components/reminders/ReminderList.tsx
"use client"

import { useReminders, useDeleteReminder } from "@/hooks/useReminders"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface ReminderListProps {
  interventionId?: string
  limit?: number
}

export function ReminderList({ interventionId, limit }: ReminderListProps) {
  const { data: reminders, isLoading, error } = useReminders()
  const deleteMutation = useDeleteReminder()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">Erreur de chargement</p>
  }

  const filtered = interventionId
    ? reminders?.filter((r) => r.intervention_id === interventionId)
    : reminders

  return (
    <ul className="space-y-2">
      {filtered?.slice(0, limit).map((reminder) => (
        <li key={reminder.id} className="flex items-center justify-between rounded border p-3">
          <span className="text-sm">{reminder.message}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteMutation.mutate(reminder.id)}
            disabled={deleteMutation.isPending}
          >
            Supprimer
          </Button>
        </li>
      ))}
    </ul>
  )
}
```

### Composant co-localise (specifique a une page)

Placer dans `app/<route>/_components/` :

```
app/interventions/
  _components/
    InterventionReminders.tsx   # Composant specifique a cette page
  _lib/
    useInterventionReminders.ts # Hook specifique a cette page
```

Les fichiers prefixes `_` ne sont pas exposes comme routes par Next.js App Router.

---

## Etape 6 : Ajouter la route / page

### Pattern de composition de page

Chaque page suit ce pattern standard :

```typescript
// app/reminders/page.tsx
"use client"

import Loader from "@/components/ui/Loader"
import { usePermissions } from "@/hooks/usePermissions"
import { ReminderList } from "@/components/reminders/ReminderList"

export default function Page() {
  const { can, isLoading } = usePermissions()

  // 1. Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    )
  }

  // 2. Permission check
  if (!can("read_interventions")) {
    return <p>Acces refuse</p>
  }

  // 3. Providers si necessaires
  return <PageContent />
}

function PageContent() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">Mes rappels</h1>
      <ReminderList />
    </div>
  )
}
```

### Ajouter a la navigation

La sidebar est definie dans `src/components/layout/app-sidebar.tsx`. Ajouter l'entree dans la configuration du menu.

---

## Etape 7 : Ecrire les tests

### Test unitaire du module API

```typescript
// tests/unit/lib/reminders-api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("remindersApi", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getMyReminders", () => {
    it("should fetch reminders with correct headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: "1", message: "Test" }]),
      })

      const { remindersApi } = await import("@/lib/api/v2/reminders")
      const result = await remindersApi.getMyReminders()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/reminders"),
        expect.objectContaining({ headers: expect.any(Object) })
      )
      expect(result).toHaveLength(1)
    })

    it("should throw on error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error" }),
      })

      const { remindersApi } = await import("@/lib/api/v2/reminders")
      await expect(remindersApi.getMyReminders()).rejects.toThrow()
    })
  })
})
```

### Test du hook

```typescript
// tests/unit/hooks/useReminders.test.ts
import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("@/lib/api/v2", () => ({
  remindersApi: {
    getMyReminders: vi.fn().mockResolvedValue([
      { id: "1", message: "Rappel test" },
    ]),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe("useReminders", () => {
  it("should fetch and return reminders", async () => {
    const { useReminders } = await import("@/hooks/useReminders")
    const { result } = renderHook(() => useReminders(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })
})
```

Voir [writing-tests.md](./writing-tests.md) pour des guides detailles sur les tests.

---

## Checklist finale

Avant de soumettre une PR, verifier :

- [ ] Types definis dans `src/types/` avec schemas Zod
- [ ] Module API dans `src/lib/api/v2/` enregistre dans la facade
- [ ] Query keys ajoutees dans `src/lib/react-query/queryKeys.ts`
- [ ] Hook(s) custom dans `src/hooks/`
- [ ] Composant(s) dans `src/components/` ou `app/*/_components/`
- [ ] Page dans `app/` avec permission check
- [ ] Tests unitaires pour la logique metier
- [ ] Tests passent localement (`npm run test`)
- [ ] Pas de regression sur les tests existants
- [ ] `npm run typecheck` passe sans erreur
- [ ] `npm run lint` passe sans erreur
