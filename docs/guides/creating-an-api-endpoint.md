# Creer un endpoint API

Guide pour creer une route API Next.js, une Edge Function Supabase, et les integrer avec le module API v2.

---

## Table des matieres

1. [Architecture API](#1-architecture-api)
2. [Route API Next.js](#2-route-api-nextjs)
3. [Edge Function Supabase](#3-edge-function-supabase)
4. [Module API v2 (client)](#4-module-api-v2-client)
5. [Gestion des erreurs](#5-gestion-des-erreurs)
6. [Tests](#6-tests)

---

## 1. Architecture API

Le projet utilise deux types d'endpoints :

| Type | Localisation | Usage |
|------|-------------|-------|
| **Route API Next.js** | `app/api/` | Auth, settings, operations serveur-only |
| **Edge Function Supabase** | `supabase/functions/` | CRUD donnees, operations metier |

Le client (browser) appelle les endpoints via le module API v2 (`src/lib/api/v2/`).

```
Browser
  -> Module API v2 (src/lib/api/v2/*.ts)
    -> Edge Function Supabase (supabase/functions/)
    -> Route API Next.js (app/api/)
      -> Supabase (direct query)
```

---

## 2. Route API Next.js

### Structure d'une route

```
app/api/
  auth/
    me/route.ts          # GET /api/auth/me
    session/route.ts     # POST/DELETE /api/auth/session
  settings/
    team/route.ts        # GET /api/settings/team
    team/user/route.ts   # PATCH /api/settings/team/user
  artisans/
    [id]/
      recalculate-status/route.ts  # POST /api/artisans/:id/recalculate-status
```

### Creer une route basique

```typescript
// app/api/example/route.ts
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    // Logique metier
    const data = { message: "Hello" }
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    )
  }
}
```

### Route avec authentification et permissions

Pattern reel utilise dans le projet :

```typescript
// app/api/settings/team/route.ts
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requirePermission, isPermissionError } from "@/lib/api/permissions"

export const runtime = "nodejs"

export async function GET(req: Request) {
  // 1. Verifier la permission
  const permCheck = await requirePermission(req, "read_users")
  if (isPermissionError(permCheck)) return permCheck.error

  // 2. Verifier le client Supabase
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    // 3. Query Supabase avec jointures
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(`
        id, firstname, lastname, email, color, status,
        code_gestionnaire, username, last_seen_at, avatar_url,
        user_roles ( roles ( name ) ),
        user_page_permissions ( page_key, has_access )
      `)
      .neq("status", "archived")
      .order("lastname", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 4. Transformer les donnees
    const users = (data || []).map((u: any) => ({
      id: u.id,
      firstname: u.firstname,
      lastname: u.lastname,
      role: u?.user_roles?.[0]?.roles?.name || null,
      // ... autres champs
    }))

    return NextResponse.json({ users })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    )
  }
}
```

### Route avec token d'authentification

Pour les routes qui necessitent l'utilisateur courant :

```typescript
// app/api/auth/me/route.ts (pattern simplifie)
import { NextResponse } from "next/server"
import { createServerSupabase, bearerFrom } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function GET(req: Request) {
  // Lire le token depuis le header Authorization OU les cookies HTTP-only
  let token = bearerFrom(req)

  if (!token) {
    const cookieStore = await cookies()
    token = cookieStore.get("sb-access-token")?.value || null
  }

  if (!token) {
    return NextResponse.json({ user: null })
  }

  const supabase = createServerSupabase(token)
  const { data: authUser, error } = await supabase.auth.getUser()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  // ... logique pour recuperer le profil
}
```

### Route avec parametre dynamique

```typescript
// app/api/artisans/[id]/recalculate-status/route.ts
import { NextResponse } from "next/server"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Utiliser l'ID du parametre
  // ...

  return NextResponse.json({ success: true })
}
```

---

## 3. Edge Function Supabase

Les Edge Functions tournent sur Deno et sont deployees sur l'infrastructure Supabase.

### Structure

```
supabase/functions/
  _shared/
    cors.ts              # Headers CORS partages
  comments/
    index.ts             # Edge Function comments
  interventions-v2/
    index.ts             # Edge Function interventions
  artisans-v2/
    index.ts             # Edge Function artisans
```

### Creer une Edge Function

```typescript
// supabase/functions/my-function/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
}

Deno.serve(async (req: Request) => {
  // 1. Gerer les preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // 2. Creer le client Supabase (service role = bypass RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 3. Parser la route
    const url = new URL(req.url)
    const pathParts = url.pathname.split("/").filter(Boolean)
    // pathParts[0] = nom de la fonction, pathParts[1+] = sous-routes

    // 4. Router par methode
    switch (req.method) {
      case "GET": {
        const { data, error } = await supabase
          .from("my_table")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) throw error

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      case "POST": {
        const body = await req.json()

        const { data, error } = await supabase
          .from("my_table")
          .insert(body)
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify(data), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      default:
        return new Response("Method not allowed", {
          status: 405,
          headers: corsHeaders,
        })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[my-function]", message)

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
```

### Deployer les Edge Functions

```bash
# Deployer toutes les fonctions
npm run deploy:functions

# Deployer une fonction specifique
npx supabase functions deploy my-function

# Lister les fonctions deployees
npm run deploy:functions:list
```

---

## 4. Module API v2 (client)

Le module client appelle les endpoints depuis le browser.

### Pattern standard

```typescript
// src/lib/api/v2/myModuleApi.ts
import { SUPABASE_FUNCTIONS_URL, getHeaders, handleResponse } from "./common/utils"
import { safeErrorMessage } from "./common/error-handler"

export const myModuleApi = {
  async getAll(params?: { limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.append("limit", params.limit.toString())
    if (params?.offset) searchParams.append("offset", params.offset.toString())

    const qs = searchParams.toString()
    const url = `${SUPABASE_FUNCTIONS_URL}/my-function/items${qs ? `?${qs}` : ""}`

    const response = await fetch(url, {
      headers: await getHeaders(),
    })
    return handleResponse(response)
  },

  async create(data: CreateInput) {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/my-function/items`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    )
    return handleResponse(response)
  },

  async update(id: string, data: UpdateInput) {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/my-function/items/${id}`,
      {
        method: "PATCH",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    )
    return handleResponse(response)
  },

  async delete(id: string) {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/my-function/items/${id}`,
      {
        method: "DELETE",
        headers: await getHeaders(),
      }
    )
    if (!response.ok) {
      throw new Error(safeErrorMessage(
        new Error(`Status ${response.status}`),
        "la suppression"
      ))
    }
  },
}
```

### Comment fonctionne `getHeaders()`

La fonction `getHeaders()` dans `src/lib/api/v2/common/utils.ts` retourne automatiquement les bons headers :

- **Browser** : Token de session utilisateur (via `supabase.auth.getSession()`)
- **Node.js** : Service role key (bypass RLS)
- **Fallback** : Anon key

```typescript
// Simplifie - le vrai code est dans src/lib/api/v2/common/utils.ts
export const getHeaders = async () => {
  const token = await getAuthToken() // session ou service role
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}
```

### Enregistrer dans la facade

```typescript
// src/lib/api/v2/index.ts
import { myModuleApi } from "./myModuleApi"

const apiV2 = {
  // ... existants
  myModule: myModuleApi,
}
export default apiV2

// Usage dans les hooks :
import { myModuleApi } from "@/lib/api/v2"
```

---

## 5. Gestion des erreurs

### Dans les Route API Next.js

```typescript
export async function GET(req: Request) {
  try {
    // ... logique
    return NextResponse.json(data)
  } catch (e: any) {
    // En dev : message complet ; en prod : message generique
    const message = process.env.NODE_ENV === "development"
      ? e?.message
      : "An unexpected error occurred"

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

### Dans les Edge Functions

```typescript
try {
  // ... logique
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error"
  console.error("[function-name]", message)
  return new Response(
    JSON.stringify({ error: message }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
}
```

### Dans le module API v2

Utiliser `safeErrorMessage` pour securiser les messages exposes au client :

```typescript
import { safeErrorMessage } from "./common/error-handler"

// En dev : affiche le message complet
// En prod : affiche "Erreur lors de la creation de l'intervention"
throw new Error(safeErrorMessage(error, "la creation de l'intervention"))
```

Voir [error-handling.md](./error-handling.md) pour plus de details.

---

## 6. Tests

### Tester une Route API

```typescript
// tests/unit/lib/my-route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

describe("GET /api/my-route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return data on success", async () => {
    // Mock des dependances
    vi.mock("@/lib/supabase-admin", () => ({
      supabaseAdmin: {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: "1" }],
            error: null,
          }),
        })),
      },
    }))

    const { GET } = await import("@/app/api/my-route/route")
    const req = new Request("http://localhost/api/my-route")
    const response = await GET(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })
})
```

### Tester un module API v2

```typescript
// tests/unit/lib/my-module-api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock("@/lib/api/v2/common/utils", () => ({
  SUPABASE_FUNCTIONS_URL: "http://test",
  getHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer test" }),
  handleResponse: vi.fn((r) => r.json()),
}))

describe("myModuleApi", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should call the correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    })

    const { myModuleApi } = await import("@/lib/api/v2/myModuleApi")
    await myModuleApi.getAll()

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test/my-function/items",
      expect.any(Object)
    )
  })
})
```
