# Artisans API Reference

> Source: `src/lib/api/v2/artisansApi.ts`

Complete API for managing artisans (contractors). Supports CRUD, search (via RPC + materialized view), metier/zone assignment, absences, stats, and geographic proximity search.

**Import:**

```typescript
import { artisansApi } from "@/lib/api/v2";
```

---

## Table of Contents

- [CRUD Operations](#crud-operations)
- [Relationships (Metiers, Zones, Documents)](#relationships)
- [Search](#search)
- [Filtering Shortcuts](#filtering-shortcuts)
- [Statistics](#statistics)
- [Absences](#absences)
- [Soft Delete and Restore](#soft-delete-and-restore)
- [Counting](#counting)
- [Geographic Search](#geographic-search)

---

## CRUD Operations

### getAll(params?)

Retrieves artisans with full relations (metiers, zones, attachments). When `search` is provided (min 2 chars), uses the `search_artisans` RPC for optimized full-text search with relevance ranking. Supports metier filtering after search results.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `ArtisanQueryParams` | No | Filtering and pagination parameters |
| params.limit | `number` | No | Max results (default: 100) |
| params.offset | `number` | No | Pagination offset |
| params.statut | `string` | No | Filter by status ID |
| params.statuts | `string[]` | No | Filter by multiple status IDs |
| params.metier | `string` | No | Filter by single metier ID |
| params.metiers | `string[]` | No | Filter by multiple metier IDs |
| params.zone | `string` | No | Filter by zone ID |
| params.gestionnaire | `string` | No | Filter by gestionnaire (manager) user ID |
| params.search | `string` | No | Full-text search query (min 2 chars triggers RPC) |
| params.statut_dossier | `string` | No | Filter by dossier status |

**Return:** `Promise<PaginatedResponse<Artisan>>`

**Example**

```typescript
const result = await artisansApi.getAll({
  search: "Martin",
  metiers: ["metier-uuid-1", "metier-uuid-2"],
  limit: 50,
});
```

---

### getById(id, include?)

Retrieves a single artisan by ID with full relations (metiers, zones, attachments, status, absences).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Artisan UUID |
| include | `string[]` | No | Additional relations to include |

**Return:** `Promise<Artisan & { artisan_metiers?, artisan_zones?, artisan_attachments?, artisan_absences?, status? }>`

---

### create(data)

Creates an artisan via the Edge Function `artisans-v2`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data | `CreateArtisanData` | Yes | Artisan data |

**Return:** `Promise<Artisan>`

---

### upsert(data)

Creates or updates an artisan via the Edge Function upsert endpoint.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data | `CreateArtisanData` | Yes | Artisan data |

**Return:** `Promise<Artisan>`

---

### upsertDirect(data, customClient?)

Direct Supabase upsert bypassing Edge Functions. Designed for bulk import. Uses `id_artisan` or `email` as conflict columns.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data | `CreateArtisanData` | Yes | Artisan data |
| customClient | `SupabaseClient` | No | Custom Supabase client for Node.js usage |

**Return:** `Promise<Artisan>`

---

### update(id, data)

Updates an artisan via the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Artisan UUID |
| data | `UpdateArtisanData` | Yes | Fields to update |

**Return:** `Promise<Artisan>`

---

### delete(id)

Soft-deletes an artisan via the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Artisan UUID |

**Return:** `Promise<{ message: string; data: Artisan }>`

---

### createBulk(artisans)

Creates multiple artisans sequentially.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisans | `CreateArtisanData[]` | Yes | Array of artisans to create |

**Return:** `Promise<BulkOperationResult>`

---

## Relationships

### createDocument(data)

Creates a document attachment for an artisan via the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data.artisan_id | `string` | Yes | Artisan UUID |
| data.kind | `string` | Yes | Document type |
| data.url | `string` | Yes | Document URL |
| data.filename | `string` | Yes | Original filename |
| data.mime_type | `string` | No | MIME type |

**Return:** `Promise<Record<string, unknown>>`

---

### createArtisanMetier(data)

Associates a metier with an artisan.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data.artisan_id | `string` | Yes | Artisan UUID |
| data.metier_id | `string` | Yes | Metier UUID |
| data.is_primary | `boolean` | No | Whether this is the primary metier |

**Return:** `Promise<Record<string, unknown>>`

---

### createArtisanZone(data)

Associates a zone with an artisan.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data.artisan_id | `string` | Yes | Artisan UUID |
| data.zone_id | `string` | Yes | Zone UUID |

**Return:** `Promise<Record<string, unknown>>`

---

### assignMetier(artisanId, metierId, isPrimary?)

Assigns a metier to an artisan via the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisanId | `string` | Yes | Artisan UUID |
| metierId | `string` | Yes | Metier UUID |
| isPrimary | `boolean` | No | Primary flag (default: `false`) |

**Return:** `Promise<Record<string, unknown>>`

---

### assignZone(artisanId, zoneId)

Assigns a zone to an artisan via the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisanId | `string` | Yes | Artisan UUID |
| zoneId | `string` | Yes | Zone UUID |

**Return:** `Promise<Record<string, unknown>>`

---

### insertArtisanMetiers(metiers)

Bulk inserts metier associations. Inserts directly into Supabase.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| metiers | `Array<{ artisan_id: string; metier_id: string; is_primary?: boolean }>` | Yes | Metier associations |

**Return:** `Promise<BulkOperationResult>`

---

### insertArtisanZones(zones)

Bulk inserts zone associations. Inserts directly into Supabase.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| zones | `Array<{ artisan_id: string; zone_id: string }>` | Yes | Zone associations |

**Return:** `Promise<BulkOperationResult>`

---

## Search

### searchByPlainNom(searchTerm, params?, customClient?)

Searches artisans by `plain_nom` field using `ilike`. Used for SST search.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| searchTerm | `string` | Yes | Search term |
| params | `ArtisanQueryParams` | No | Additional filters |
| customClient | `SupabaseClient` | No | Custom client |

**Return:** `Promise<PaginatedResponse<Artisan>>`

---

### searchByName(searchTerm, params?)

Searches artisans by `prenom`, `nom`, or `raison_sociale` using `ilike`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| searchTerm | `string` | Yes | Search term |
| params | `ArtisanQueryParams` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<Artisan>>`

---

### searchArtisans(params)

Advanced search combining text search with geographic proximity. Uses `search_artisans_with_distance` or `search_artisans` RPC.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params.searchQuery | `string` | Yes | Search text |
| params.latitude | `number \| null` | No | Latitude for distance calc |
| params.longitude | `number \| null` | No | Longitude for distance calc |
| params.metier_id | `string \| null` | No | Filter by metier |
| params.max_distance_km | `number` | No | Max distance in km (default: `50`) |
| params.limit | `number` | No | Max results (default: `20`) |
| params.offset | `number` | No | Offset (default: `0`) |

**Return:** `Promise<PaginatedResponse<Artisan>>`

---

## Filtering Shortcuts

### getByGestionnaire(gestionnaireId, params?)

Shorthand for `getAll({ ...params, gestionnaire: gestionnaireId })`.

**Return:** `Promise<PaginatedResponse<Artisan>>`

### getByStatus(statusId, params?)

Shorthand for `getAll({ ...params, statut: statusId })`.

**Return:** `Promise<PaginatedResponse<Artisan>>`

### getByMetier(metierId, params?)

Shorthand for `getAll({ ...params, metier: metierId })`.

**Return:** `Promise<PaginatedResponse<Artisan>>`

### getByZone(zoneId, params?)

Shorthand for `getAll({ ...params, zone: zoneId })`.

**Return:** `Promise<PaginatedResponse<Artisan>>`

---

## Statistics

### getStatsByGestionnaire(gestionnaireId, startDate?, endDate?)

Retrieves artisan statistics grouped by status for a gestionnaire. Includes counts for artisans created in period, with "missionne" status, and dossier completeness.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| gestionnaireId | `string` | Yes | Gestionnaire user UUID |
| startDate | `string` | No | Filter start date |
| endDate | `string` | No | Filter end date |

**Return:** `Promise<ArtisanStatsByStatus>`

---

### getTopArtisansByGestionnaire(gestionnaireId)

Retrieves the top artisans for a gestionnaire ranked by number of interventions.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| gestionnaireId | `string` | Yes | Gestionnaire user UUID |

**Return:** `Promise<Array<{ artisan_id, artisan_nom, intervention_count, total_margin, average_margin_percentage }>>`

---

### getRecentInterventionsByArtisanWithMargins(artisanId, limit?, startDate?, endDate?)

Retrieves recent interventions for a specific artisan with margin calculations.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisanId | `string` | Yes | Artisan UUID |
| limit | `number` | No | Max results (default: `5`) |
| startDate | `string` | No | Filter start date |
| endDate | `string` | No | Filter end date |

**Return:** `Promise<Array<{ id, id_inter, date, status, costs, margin }>>`

---

### getArtisansByStatusWithRecentInterventions(gestionnaireId, statusLabel, startDate?, endDate?, limit?)

Retrieves artisans filtered by status label with their recent interventions.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| gestionnaireId | `string` | Yes | Gestionnaire UUID |
| statusLabel | `string` | Yes | Status label to filter |
| startDate | `string` | No | Period start |
| endDate | `string` | No | Period end |
| limit | `number` | No | Max results (default: `10`) |

**Return:** `Promise<Array<{ artisan, recent_interventions }>>`

---

### getArtisansWithDossiersACompleter(gestionnaireId)

Retrieves artisans that have incomplete dossiers (missing required documents).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| gestionnaireId | `string` | Yes | Gestionnaire UUID |

**Return:** `Promise<Array<{ artisan_id, artisan_nom, missing_documents }>>`

---

## Absences

### getAbsences(artisanId)

Retrieves all absences for an artisan.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisanId | `string` | Yes | Artisan UUID |

**Return:** `Promise<Array<{ id, start_date, end_date, reason, is_confirmed, created_at }>>`

---

### createAbsence(artisanId, absence)

Creates a new absence record for an artisan.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisanId | `string` | Yes | Artisan UUID |
| absence.start_date | `string` | Yes | Start date |
| absence.end_date | `string` | Yes | End date |
| absence.reason | `string` | No | Reason for absence |
| absence.is_confirmed | `boolean` | No | Confirmation status |

**Return:** `Promise<{ id, start_date, end_date, reason, is_confirmed }>`

---

### updateAbsence(absenceId, updates)

Updates an existing absence record.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| absenceId | `string` | Yes | Absence UUID |
| updates.start_date | `string` | No | New start date |
| updates.end_date | `string` | No | New end date |
| updates.reason | `string` | No | New reason |
| updates.is_confirmed | `boolean` | No | New confirmation status |

**Return:** `Promise<void>`

---

### deleteAbsence(absenceId)

Deletes an absence record.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| absenceId | `string` | Yes | Absence UUID |

**Return:** `Promise<void>`

---

## Soft Delete and Restore

### checkDeletedArtisan(params)

Checks if a deleted artisan exists with the given email or SIRET.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params.email | `string` | No | Email to check |
| params.siret | `string` | No | SIRET number to check |

**Return:** `Promise<{ found: boolean; artisan?: { id, prenom, nom, email, deleted_at } }>`

---

### restore(artisanId, newData?)

Restores a soft-deleted artisan via the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisanId | `string` | Yes | Artisan UUID |
| newData | `CreateArtisanData` | No | Optional new data to apply |

**Return:** `Promise<Artisan>`

---

### permanentDelete(artisanId)

Permanently deletes an artisan and all related data via the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisanId | `string` | Yes | Artisan UUID |

**Return:** `Promise<void>`

---

### getPreviousStatus(artisanId, beforeStatusCode?)

Retrieves the previous status of an artisan (useful for status rollback).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisanId | `string` | Yes | Artisan UUID |
| beforeStatusCode | `string` | No | Current status code to look before |

**Return:** `Promise<{ statusId: string | null; statusCode: string | null; statusLabel: string | null }>`

---

## Counting

### getTotalCount(params?)

Returns the total number of active artisans matching filters.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params.gestionnaire | `string` | No | Filter by gestionnaire |
| params.statut | `string` | No | Filter by status |

**Return:** `Promise<number>`

---

### getCountWithFilters(params?)

Returns filtered count of artisans. Supports multiple status IDs and metier filters.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params.gestionnaire | `string` | No | Filter by gestionnaire |
| params.statut | `string` | No | Filter by single status |
| params.statuts | `string[]` | No | Filter by multiple statuses |
| params.metier | `string` | No | Filter by metier |
| params.metiers | `string[]` | No | Filter by multiple metiers |
| params.zone | `string` | No | Filter by zone |
| params.search | `string` | No | Search filter |

**Return:** `Promise<number>`

---

## Geographic Search

### getNearbyArtisans(params)

Finds artisans near a geographic location using the Haversine formula via the `get_nearby_artisans` Supabase RPC.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params.latitude | `number` | Yes | Center latitude |
| params.longitude | `number` | Yes | Center longitude |
| params.offset | `number` | No | Pagination offset |
| params.limit | `number` | No | Max results (default: `20`) |
| params.maxDistanceKm | `number` | No | Max radius in km (default: `50`) |
| params.metier_ids | `string[]` | No | Filter by metier IDs |

**Return:** `Promise<NearbyArtisansResponse>`

```typescript
interface NearbyArtisansResponse {
  data: NearbyArtisan[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

interface NearbyArtisan extends Artisan {
  distance_km: number;
}
```

**Example**

```typescript
const nearby = await artisansApi.getNearbyArtisans({
  latitude: 48.8566,
  longitude: 2.3522,
  maxDistanceKm: 30,
  metier_ids: ["metier-uuid"],
});
```
