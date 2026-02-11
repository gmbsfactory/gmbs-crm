# Gestion des erreurs

Guide pour gerer les erreurs dans GMBS-CRM : ErrorHandler centralise, safeErrorMessage pour les API, patterns dans les hooks et composants.

---

## Table des matieres

1. [Architecture de gestion d'erreurs](#1-architecture-de-gestion-derreurs)
2. [ErrorHandler centralise](#2-errorhandler-centralise)
3. [safeErrorMessage (API)](#3-safeerrormessage-api)
4. [Erreurs dans les hooks TanStack Query](#4-erreurs-dans-les-hooks-tanstack-query)
5. [Erreurs dans les API routes](#5-erreurs-dans-les-api-routes)
6. [Erreurs dans les Edge Functions](#6-erreurs-dans-les-edge-functions)
7. [Erreurs cote composant](#7-erreurs-cote-composant)
8. [Helpers d'erreurs typees](#8-helpers-derreurs-typees)
9. [Tests](#9-tests)

---

## 1. Architecture de gestion d'erreurs

```
src/lib/errors/
  error-handler.ts         # ErrorHandler centralise + AppError + Errors helpers

src/lib/api/v2/common/
  error-handler.ts         # safeErrorMessage (securise les messages en prod)
```

Le projet utilise deux systemes complementaires :

| Systeme | Usage | Fichier |
|---------|-------|---------|
| `ErrorHandler` | Gestion centralisee avec severity, fallback, propagation | `src/lib/errors/error-handler.ts` |
| `safeErrorMessage` | Securiser les messages exposes au client en production | `src/lib/api/v2/common/error-handler.ts` |

---

## 2. ErrorHandler centralise

### Classe AppError

Erreur typee avec code, status HTTP et metadonnees :

```typescript
// src/lib/errors/error-handler.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,        // Ex: "NOT_FOUND"
    public readonly statusCode?: number,  // Ex: 404
    public readonly context?: string,     // Ex: "interventionsApi.getById"
    public readonly metadata?: Record<string, any>
  ) {
    super(message)
    this.name = "AppError"
  }
}
```

### Methode `handle()`

Gere une erreur avec logging structure, fallback optionnel et propagation conditionnelle :

```typescript
import { ErrorHandler } from "@/lib/errors/error-handler"

try {
  const result = await interventionsApi.getById(id)
  return result
} catch (error) {
  return ErrorHandler.handle(error, {
    context: "interventionsApi",     // Module
    operation: "getById",            // Fonction
    fallback: null,                  // Valeur de retour si propagate=false
    propagate: false,                // false = retourne fallback, true = re-lance
    severity: "medium",             // low | medium | high | critical
    metadata: { interventionId: id },
  })
}
```

**Severites et logging :**

| Severite | Log | Usage |
|----------|-----|-------|
| `critical` | `console.error("[CRITICAL]")` | Perte de donnees, base inaccessible |
| `high` | `console.error("[ERROR]")` | Erreur API, echec mutation |
| `medium` | `console.warn("[WARN]")` | Fallback utilise, cache expire |
| `low` | `console.info("[INFO]")` | Erreur attendue (404, validation) |

### Methode `wrap()` - Wrapper automatique

Encapsule une fonction async avec gestion d'erreur automatique :

```typescript
import { ErrorHandler } from "@/lib/errors/error-handler"

// Avant : chaque appel necessite un try/catch
const getAll = async () => {
  try {
    return await interventionsApi.getAll()
  } catch (error) {
    console.error(error)
    return []
  }
}

// Apres : wrapper automatique
const safeGetAll = ErrorHandler.wrap(interventionsApi.getAll, {
  context: "interventionsApi",
  operation: "getAll",
  fallback: [],
})

// Utilisation : plus besoin de try/catch
const data = await safeGetAll(params)
```

Pour les fonctions synchrones, utiliser `wrapSync()` :

```typescript
const safeCalculate = ErrorHandler.wrapSync(calculateMargin, {
  context: "marginCalculator",
  operation: "calculate",
  fallback: { margin: 0, isValid: false },
})
```

---

## 3. safeErrorMessage (API)

Securise les messages d'erreur dans les reponses API :

```typescript
// src/lib/api/v2/common/error-handler.ts
export function safeErrorMessage(error: unknown, context: string): string {
  const fullMessage = error instanceof Error ? error.message : String(error)

  if (isDev) {
    return fullMessage // Dev : message complet pour debug
  }

  // Prod : log complet cote serveur, message generique cote client
  console.error(`[safeErrorMessage] Erreur lors de ${context}:`, error)
  return `Erreur lors de ${context}`
}
```

**Exemples :**

```typescript
// En developpement :
safeErrorMessage(new Error("PGRST116: no rows"), "la recherche")
// -> "PGRST116: no rows"

// En production :
safeErrorMessage(new Error("PGRST116: no rows"), "la recherche")
// -> "Erreur lors de la recherche"
// + log serveur avec le message complet
```

**Pourquoi :** Empeche la fuite de details techniques (noms de tables, codes PostgreSQL, stack traces) vers le client en production.

---

## 4. Erreurs dans les hooks TanStack Query

### Erreur de query (lecture)

```typescript
const { data, error, isError, isLoading } = useQuery({
  queryKey: interventionKeys.detail(id),
  queryFn: () => interventionsApi.getById(id),
})

// Dans le composant :
if (isError) {
  return <p className="text-sm text-destructive">Erreur de chargement</p>
}
```

### Erreur de mutation avec rollback optimiste

```typescript
const mutation = useMutation({
  mutationFn: interventionsApi.update,

  // 1. Avant la mutation : sauvegarder l'etat et appliquer l'update optimiste
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: interventionKeys.lists() })
    const previous = queryClient.getQueryData(interventionKeys.lists())

    queryClient.setQueriesData(
      { queryKey: interventionKeys.lists() },
      (old) => applyOptimisticUpdate(old, variables)
    )

    return { previous }
  },

  // 2. En cas d'erreur : rollback vers l'etat precedent
  onError: (error, _variables, context) => {
    if (context?.previous) {
      queryClient.setQueryData(interventionKeys.lists(), context.previous)
    }
    // Afficher un toast d'erreur
    toast.error("Erreur lors de la mise a jour")
  },

  // 3. Toujours : re-fetcher les donnees fraiches
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
  },
})
```

### Pattern global d'erreur TanStack Query

La configuration globale dans le QueryClientProvider peut definir un comportement par defaut :

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,                  // 3 tentatives avant echec
      retryDelay: (attempt) =>   // Backoff exponentiel
        Math.min(1000 * 2 ** attempt, 30000),
      staleTime: 30_000,        // 30s avant re-fetch
    },
    mutations: {
      retry: 0,                 // Pas de retry sur mutations
    },
  },
})
```

---

## 5. Erreurs dans les API routes

### Pattern standard

```typescript
// app/api/my-route/route.ts
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    // Logique metier
    const data = await fetchData()
    return NextResponse.json(data)
  } catch (e: any) {
    // Log complet cote serveur
    console.error("[my-route] Error:", e?.message, e?.stack)

    // Reponse securisee
    return NextResponse.json(
      {
        error: e?.message || "Unexpected error",
        // Details supplementaires en dev uniquement
        ...(process.env.NODE_ENV === "development" && {
          details: { stack: e?.stack, name: e?.name },
        }),
      },
      { status: 500 }
    )
  }
}
```

### Erreurs d'authentification

```typescript
// Verifier le token avant toute operation
const token = bearerFrom(req)
if (!token) {
  return NextResponse.json({ user: null }) // 200 avec user null (pas 401)
}

const { data: authUser, error: authError } = await supabase.auth.getUser()
if (authError) {
  return NextResponse.json(
    { error: authError.message, code: authError.status },
    { status: 401 }
  )
}
```

### Erreurs de permission

```typescript
import { requirePermission, isPermissionError } from "@/lib/api/permissions"

const permCheck = await requirePermission(req, "read_users")
if (isPermissionError(permCheck)) {
  return permCheck.error // Retourne 403 automatiquement
}
```

### Erreurs Supabase

```typescript
const { data, error } = await supabaseAdmin
  .from("interventions")
  .select("*")

if (error) {
  // Codes d'erreur courants :
  // PGRST116 : no rows returned (maybeSingle quand aucun resultat)
  // PGRST301 : relation error (jointure invalide)
  // PGRST205 : table not found

  if (error.code === "PGRST116") {
    return NextResponse.json({ data: null }) // Pas une erreur
  }

  return NextResponse.json({ error: error.message }, { status: 500 })
}
```

---

## 6. Erreurs dans les Edge Functions

```typescript
// supabase/functions/my-function/index.ts
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Logique metier
    const result = await processRequest(req)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    // Log structure pour le monitoring Supabase
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(JSON.stringify({
      function: "my-function",
      error: message,
      timestamp: new Date().toISOString(),
    }))

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: error instanceof AppError ? error.statusCode || 500 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
```

---

## 7. Erreurs cote composant

### Affichage inline

```tsx
function InterventionDetail({ id }) {
  const { data, error, isLoading } = useQuery({
    queryKey: interventionKeys.detail(id),
    queryFn: () => interventionsApi.getById(id),
  })

  if (isLoading) return <Skeleton className="h-48" />

  if (error) {
    return (
      <div className="rounded border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          Impossible de charger l'intervention.
        </p>
        <button
          onClick={() => queryClient.refetchQueries({ queryKey: interventionKeys.detail(id) })}
          className="mt-2 text-xs underline"
        >
          Reessayer
        </button>
      </div>
    )
  }

  return <InterventionContent data={data} />
}
```

### Toast pour les mutations

```typescript
import { toast } from "sonner"

const mutation = useMutation({
  mutationFn: interventionsApi.update,
  onSuccess: () => {
    toast.success("Intervention mise a jour")
  },
  onError: (error) => {
    toast.error(
      error instanceof AppError
        ? error.message
        : "Erreur lors de la mise a jour"
    )
  },
})
```

---

## 8. Helpers d'erreurs typees

Le module `Errors` fournit des factories pour creer des erreurs standardisees :

```typescript
import { Errors } from "@/lib/errors/error-handler"

// 404 Not Found
throw Errors.notFound("Intervention", interventionId)
// -> AppError("Intervention avec l'ID xxx introuvable", "NOT_FOUND", 404)

// 401 Unauthorized
throw Errors.unauthorized("Token expire")
// -> AppError("Token expire", "UNAUTHORIZED", 401)

// 403 Forbidden
throw Errors.forbidden("Acces interdit a cette ressource")
// -> AppError("Acces interdit...", "FORBIDDEN", 403)

// 400 Bad Request
throw Errors.badRequest("Parametre manquant")
// -> AppError("Parametre manquant", "BAD_REQUEST", 400)

// 500 Internal Error
throw Errors.internal("Erreur de base de donnees")
// -> AppError("Erreur de base...", "INTERNAL_ERROR", 500)

// 400 Validation Error avec detail des champs
throw Errors.validation("Donnees invalides", {
  email: "Format invalide",
  name: "Requis",
})
// -> AppError("Donnees invalides", "VALIDATION_ERROR", 400, { fields: { email, name } })
```

---

## 9. Tests

### Tester ErrorHandler.handle()

```typescript
import { describe, it, expect, vi } from "vitest"
import { ErrorHandler, AppError } from "@/lib/errors/error-handler"

describe("ErrorHandler", () => {
  it("should return fallback when propagate is false", () => {
    const result = ErrorHandler.handle(new Error("test"), {
      context: "test",
      fallback: [],
      propagate: false,
    })
    expect(result).toEqual([])
  })

  it("should throw AppError when propagate is true", () => {
    expect(() =>
      ErrorHandler.handle(new Error("test"), {
        context: "test",
        propagate: true,
      })
    ).toThrow(AppError)
  })

  it("should log with correct severity", () => {
    const consoleSpy = vi.spyOn(console, "error")

    ErrorHandler.handle(new Error("critical error"), {
      context: "test",
      severity: "critical",
      fallback: null,
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[CRITICAL]"),
      expect.any(Object)
    )
  })
})
```

### Tester safeErrorMessage

```typescript
import { describe, it, expect, vi } from "vitest"

describe("safeErrorMessage", () => {
  it("should return full message in dev", () => {
    // NODE_ENV = 'test' (considere comme dev)
    const { safeErrorMessage } = require("@/lib/api/v2/common/error-handler")
    const result = safeErrorMessage(new Error("PGRST116"), "la recherche")
    expect(result).toBe("PGRST116")
  })
})
```

### Tester les erreurs dans les mutations

```typescript
import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

describe("useUpdateIntervention", () => {
  it("should rollback on error", async () => {
    vi.mock("@/lib/api/v2", () => ({
      interventionsApi: {
        update: vi.fn().mockRejectedValue(new Error("Network error")),
      },
    }))

    const { result } = renderHook(() => useUpdateIntervention(), {
      wrapper: createQueryWrapper(),
    })

    act(() => {
      result.current.mutate({ id: "1", data: { status: "ACCEPTE" } })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    // Verifier que le cache a ete restaure (rollback)
  })
})
```
