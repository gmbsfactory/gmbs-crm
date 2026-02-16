# Supabase Edge Functions Reference

> Source: `supabase/functions/`

13+ Supabase Edge Functions running on the Deno runtime. All functions use CORS handling via `supabase/functions/_shared/cors.ts`. L'authentification utilisateur passe par `_shared/auth.ts` (verification JWT). Les operations admin utilisent `SUPABASE_SERVICE_ROLE_KEY`.

---

## Table of Contents

- [Shared Utilities](#shared-utilities)
- [interventions-v2](#interventions-v2)
- [interventions-v2-admin-dashboard-stats](#interventions-v2-admin-dashboard-stats)
- [artisans-v2](#artisans-v2)
- [check-inactive-users](#check-inactive-users)
- [users](#users)
- [comments](#comments)
- [documents](#documents)
- [cache](#cache)
- [process-avatar](#process-avatar)
- [pull (Google Sheets Sync)](#pull)
- [push (Google Sheets Sync)](#push)

---

## interventions-v2

> Source: `supabase/functions/interventions-v2/index.ts`

Edge Function principale pour le CRUD complet des interventions. Gere les requetes paginables avec filtres avances, JOINs complexes (artisans, couts, paiements, tenants, owners), et logique metier (deduplication, transitions de statuts).

**Methodes:** GET (liste paginee, detail, light), POST (creation, upsert import)

**Authentification:** Via `_shared/auth.ts` — verification JWT stricte, plus de fallback `x-user-id`.

**Fonctionnalites:**
- Pagination serveur avec prefetch
- Filtres multiples (statut, agence, gestionnaire, metier, date, recherche texte)
- Include optionnel : `artisans`, `costs`, `payments`, `owner`, `tenant`
- Mode `light` pour warm-up (champs reduits)
- Upsert pour les imports Google Sheets

---

## interventions-v2-admin-dashboard-stats

> Source: `supabase/functions/interventions-v2-admin-dashboard-stats/index.ts`

Statistiques agregees pour le dashboard admin. Fournit les KPIs globaux (nombre d'interventions par statut, par agence, par periode, chiffre d'affaires, marge).

**Methode:** GET

---

## artisans-v2

> Source: `supabase/functions/artisans-v2/index.ts`

CRUD complet des artisans avec gestion des metiers, zones d'intervention, absences, et statuts. Supporte les filtres avances et la pagination.

**Methodes:** GET, POST, PUT, DELETE

---

## check-inactive-users

> Source: `supabase/functions/check-inactive-users/index.ts`

Cron-triggered function that detects and marks inactive users as offline. Runs every 60 seconds.

**Trigger:** Cron job (every 60s) or manual invocation with service role key.

**Authentication:** Requires `Authorization` header containing the `SUPABASE_SERVICE_ROLE_KEY`.

**Logic:**
1. Finds all users with status `connected`, `busy`, or `dnd`
2. Checks if their `last_seen_at` is older than 90 seconds (3x the heartbeat interval of 30s)
3. Sets their status to `offline`

**Inactivity Threshold:** 90 seconds

**Response (200):**

```json
{
  "success": true,
  "users_set_offline": 2,
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "last_seen_at": "2024-01-01T12:00:00Z",
      "previous_status": "connected"
    }
  ],
  "checked_at": "2024-01-01T12:01:30Z"
}
```

**Response (200, no inactive users):**

```json
{
  "success": true,
  "message": "No inactive users found",
  "checked_at": "2024-01-01T12:01:30Z"
}
```

---

## users

> Source: `supabase/functions/users/index.ts`

REST API for user data. Provides read-only access to user profiles.

### GET /users

Retrieves all active users (where `delete_date` is null).

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| role | `string` | Filter by role (not yet implemented) |

**Response (200):**

```json
[
  {
    "id": "uuid",
    "name": "Doe",
    "prenom": "John",
    "username": "johndoe",
    "email": "john@example.com",
    "roles": [],
    "tokenVersion": 0,
    "color": "#FF5733",
    "deleteDate": null
  }
]
```

**Note:** Response includes a simulated 100ms delay for MockAPI compatibility.

### GET /users/{id}

Retrieves a single user by UUID.

**Response (200):** Same structure as above (single object).

**Response (404):** `{ "error": "message" }`

### GET /users/username/{username}

Retrieves a user by username.

**Query Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| username | `string` | Yes | Username to search |

**Response (200):** Same structure as above (single object).

**Response (400):** `{ "error": "Username parameter required" }`

---

## comments

> Source: `supabase/functions/comments/index.ts`

Full CRUD API for comments on interventions, artisans, and clients.

**Supported comment types:** `internal`, `external`, `system`

**Supported reason types:** `archive`, `done`

### GET /comments

Retrieves comments with filtering and pagination.

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| entity_type | `"intervention" \| "artisan" \| "client"` | Filter by entity type |
| entity_id | `string` | Filter by entity ID |
| comment_type | `string` | Filter by comment type |
| is_internal | `"true" \| "false"` | Filter by internal flag |
| author_id | `string` | Filter by author |
| limit | `number` | Max results (default: 50) |
| offset | `number` | Pagination offset (default: 0) |

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "entity_id": "intervention-uuid",
      "entity_type": "intervention",
      "content": "Comment text",
      "comment_type": "internal",
      "is_internal": true,
      "author_id": "user-uuid",
      "reason_type": null,
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z",
      "users": {
        "id": "user-uuid",
        "firstname": "John",
        "lastname": "Doe",
        "username": "johndoe",
        "color": "#FF5733",
        "avatar_url": null
      }
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1,
    "hasMore": false
  }
}
```

### GET /comments/{id}

Retrieves a single comment by ID with author details.

**Response (200):** Single comment object (same structure as list items).

**Response (404):** `{ "error": "Comment not found" }`

### POST /comments

Creates a new comment.

**Request Body:**

```json
{
  "entity_id": "intervention-uuid",
  "entity_type": "intervention",
  "content": "Comment text",
  "comment_type": "internal",
  "is_internal": true,
  "author_id": "user-uuid",
  "reason_type": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| entity_id | `string` | Yes | Target entity UUID |
| entity_type | `"intervention" \| "artisan" \| "client"` | Yes | Entity type |
| content | `string` | Yes | Comment text |
| comment_type | `string` | No | Type (default: `"internal"`) |
| is_internal | `boolean` | No | Internal flag (default: `true`) |
| author_id | `string` | No | Author user UUID |
| reason_type | `"archive" \| "done" \| null` | No | Reason type |

**Response (201):** Created comment object with author details.

### PUT /comments/{id}

Updates a comment.

**Request Body:**

```json
{
  "content": "Updated text",
  "comment_type": "external",
  "is_internal": false,
  "reason_type": "done"
}
```

**Response (200):** Updated comment object.

### DELETE /comments/{id}

Permanently deletes a comment.

**Response (200):** `{ "message": "Comment deleted successfully", "data": { ... } }`

### GET /comments/types

Returns supported comment types and entity types.

**Response (200):**

```json
{
  "comment_types": ["internal", "external", "system"],
  "entity_types": ["intervention", "artisan", "client"],
  "default_type": "internal",
  "internal_default": true
}
```

### GET /comments/stats

Returns comment statistics, optionally filtered by entity.

**Query Parameters**

| Name | Type | Description |
|------|------|-------------|
| entity_type | `string` | Filter by entity type |
| entity_id | `string` | Filter by entity ID |

**Response (200):**

```json
{
  "total": 42,
  "by_type": { "internal": 30, "external": 10, "system": 2 },
  "by_internal": { "internal": 30, "external": 12 },
  "recent_count": 8
}
```

`recent_count` includes comments from the last 7 days.

---

## process-avatar

> Source: `supabase/functions/process-avatar/index.ts`

Image processing function for artisan profile photos. Normalizes, resizes, and converts images to WebP/JPEG formats.

**Method:** POST only

### POST /process-avatar

Processes an artisan's profile photo: downloads the original, generates multiple sizes, uploads derivatives to Supabase Storage, and updates the attachment metadata.

**Request Body:**

```json
{
  "artisan_id": "artisan-uuid",
  "attachment_id": "attachment-uuid",
  "image_url": "https://storage.example.com/original.jpg",
  "mime_type": "image/jpeg"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| artisan_id | `string` | Yes | Artisan UUID |
| attachment_id | `string` | Yes | Attachment record UUID |
| image_url | `string` | Yes | URL of the original image |
| mime_type | `string` | No | Original MIME type |

**Processing Pipeline:**
1. Downloads the original image from `image_url`
2. Computes SHA-256 hash of the original content
3. For each target size (40px, 80px, 160px):
   - Rotates based on EXIF data
   - Resizes to square with center crop (`fit: cover`)
   - Converts to sRGB, removes alpha channel
   - Converts to WebP (quality 85) or JPEG (quality 90) fallback
   - Strips all metadata
4. Uploads to `avatars/{artisan_id}/avatar_{hash}_{size}.{format}` in the `documents` bucket
5. Updates `artisan_attachments` record with `content_hash`, `derived_sizes`, and `mime_preferred`

**Generated Sizes:** 40px, 80px, 160px (square)

**Preferred Format:** WebP (with JPEG fallback)

**Cache-Control:** `public, max-age=31536000, immutable`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "attachment_id": "attachment-uuid",
    "content_hash": "a1b2c3d4e5f6...",
    "derived_sizes": {
      "40": "https://storage.example.com/avatars/artisan-id/avatar_hash_40.webp",
      "80": "https://storage.example.com/avatars/artisan-id/avatar_hash_80.webp",
      "160": "https://storage.example.com/avatars/artisan-id/avatar_hash_160.webp"
    },
    "mime_preferred": "image/webp"
  }
}
```

---

## pull

> Source: `supabase/functions/pull/index.ts`

Google Sheets to Supabase synchronization. Reads artisan and intervention data from Google Sheets and imports/updates records in the database.

**Method:** POST

**Authentication:** Service role key required.

**Sync Direction:** Google Sheets -> Supabase

**Supported Entities:**
- Artisans (with metiers, zones, and related data)
- Interventions (with status transitions and cost data)

**Features:**
- Reads from configured Google Sheets using the Google Sheets API
- Maps spreadsheet columns to database fields
- Uses `enumsApi` find-or-create functions for reference resolution
- Handles upsert via `id_inter` / `id_artisan` conflict columns
- Creates automatic status transition chains for interventions

---

## push

> Source: `supabase/functions/push/index.ts`

Supabase to Google Sheets synchronization. Exports data from the database back to Google Sheets.

**Method:** POST

**Authentication:** Service role key required.

**Sync Direction:** Supabase -> Google Sheets

**Features:**
- Reads current data from Supabase tables
- Formats data for Google Sheets columns
- Updates the Google Sheets via the Google Sheets API
- Supports both artisan and intervention data export

---

## documents

> Source: `supabase/functions/documents/index.ts`

Gestion des documents et pieces jointes. Upload vers Supabase Storage, listing par entite, et gestion des metadonnees.

**Methodes:** GET (liste par entite), POST (upload), DELETE

---

## cache

> Source: `supabase/functions/cache/index.ts`

Gestion du cache de reference. Permet l'invalidation manuelle du cache de donnees de reference (agences, metiers, statuts, utilisateurs).

**Methode:** POST (invalidation)

---

## Shared Utilities

### Authentication Helper

> Source: `supabase/functions/_shared/auth.ts`

Module partage pour la verification JWT dans les Edge Functions. Remplace l'ancien pattern `x-user-id` header par une verification stricte via `supabase.auth.getUser(token)`.

```typescript
import { getAuthUserId, requireAuth } from '../_shared/auth.ts'

// Optionnel — retourne null si non authentifie
const userId = await getAuthUserId(req, supabase)

// Obligatoire — throw si non authentifie
const userId = await requireAuth(req, supabase)
```

### CORS Handling

> Source: `supabase/functions/_shared/cors.ts`

All Edge Functions use `getCorsHeaders(req)` to generate CORS headers. Every function handles `OPTIONS` preflight requests as the very first check, returning `200 OK` with CORS headers.

```typescript
import { getCorsHeaders } from '../_shared/cors.ts';

// In every Edge Function:
if (req.method === 'OPTIONS') {
  return new Response('ok', {
    status: 200,
    headers: getCorsHeaders(req),
  });
}
```

### Environment Variables

All Edge Functions use these environment variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin access |
| `SUPABASE_PUBLIC_URL` | Public-facing URL (for fixing internal Docker URLs) |
