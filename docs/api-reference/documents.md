# Documents API Reference

> Source: `src/lib/api/v2/documentsApi.ts`

API for managing document attachments for both interventions and artisans. Supports file upload to Supabase Storage, metadata creation, and bulk operations. Automatically normalizes document `kind` values for interventions.

**Import:**

```typescript
import { documentsApi } from "@/lib/api/v2";
```

---

## Table of Contents

- [CRUD Operations](#crud-operations)
- [Upload](#upload)
- [Filtering Shortcuts](#filtering-shortcuts)
- [Search and Stats](#search-and-stats)
- [Bulk Operations](#bulk-operations)
- [Helpers](#helpers)

---

## CRUD Operations

### getAll(params?)

Retrieves documents via the Edge Function `documents`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `DocumentQueryParams` | No | Filtering parameters |
| params.entity_type | `"intervention" \| "artisan"` | No | Filter by entity type |
| params.entity_id | `string` | No | Filter by entity ID |
| params.kind | `string` | No | Filter by document kind |
| params.limit | `number` | No | Max results |
| params.offset | `number` | No | Pagination offset |

**Return:** `Promise<PaginatedResponse<InterventionAttachment | ArtisanAttachment>>`

**Example**

```typescript
const docs = await documentsApi.getAll({
  entity_type: "intervention",
  entity_id: "intervention-uuid",
  kind: "facturesGMBS",
});
```

---

### getById(id, entityType?)

Retrieves a single document by ID.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Document UUID |
| entityType | `"intervention" \| "artisan"` | No | Entity type (default: `"intervention"`) |

**Return:** `Promise<InterventionAttachment | ArtisanAttachment>`

---

### create(data)

Creates a document metadata record. In Node.js, inserts directly into Supabase. In the browser, uses the Edge Function. Normalizes the `kind` field for interventions.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data | `CreateDocumentData` | Yes | Document data |
| data.entity_type | `"intervention" \| "artisan"` | Yes | Entity type |
| data.entity_id | `string` | Yes | Entity UUID |
| data.kind | `string` | Yes | Document kind (auto-normalized for interventions) |
| data.url | `string` | Yes | Document URL |
| data.filename | `string` | No | Original filename |
| data.mime_type | `string` | No | MIME type |
| data.file_size | `number` | No | File size in bytes |
| data.created_by | `string` | No | Creator user ID |
| data.created_by_display | `string` | No | Creator display name |
| data.created_by_code | `string` | No | Creator code |
| data.created_by_color | `string` | No | Creator color |

**Return:** `Promise<InterventionAttachment | ArtisanAttachment>`

---

### update(id, data, entityType?)

Updates a document metadata record via the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Document UUID |
| data | `UpdateDocumentData` | Yes | Fields to update |
| entityType | `"intervention" \| "artisan"` | No | Entity type (default: `"intervention"`) |

**Return:** `Promise<InterventionAttachment | ArtisanAttachment>`

---

### delete(id, entityType?)

Deletes a document via the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Document UUID |
| entityType | `"intervention" \| "artisan"` | No | Entity type (default: `"intervention"`) |

**Return:** `Promise<{ message: string; data: any }>`

---

## Upload

### upload(data)

Uploads a file with base64-encoded content. In Node.js, uploads directly to Supabase Storage and creates the metadata record. In the browser, uses the Edge Function. Generates unique filenames and normalizes `kind` for interventions.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data | `FileUploadData` | Yes | Upload data |
| data.entity_type | `"intervention" \| "artisan"` | Yes | Entity type |
| data.entity_id | `string` | Yes | Entity UUID |
| data.kind | `string` | Yes | Document kind |
| data.content | `string` | Yes | Base64-encoded file content (with or without `data:...` prefix) |
| data.filename | `string` | Yes | Original filename |
| data.mime_type | `string` | Yes | MIME type |
| data.file_size | `number` | No | File size in bytes |
| data.created_by | `string` | No | Creator user ID |
| data.created_by_display | `string` | No | Creator display name |
| data.created_by_code | `string` | No | Creator code |
| data.created_by_color | `string` | No | Creator color |

**Return:** `Promise<InterventionAttachment | ArtisanAttachment>`

**Example**

```typescript
const doc = await documentsApi.upload({
  entity_type: "intervention",
  entity_id: "intervention-uuid",
  kind: "facturesGMBS",
  content: "data:application/pdf;base64,JVBERi0...",
  filename: "facture_001.pdf",
  mime_type: "application/pdf",
  file_size: 12345,
});
```

---

## Filtering Shortcuts

### getByIntervention(interventionId, params?)

Shorthand for `getAll({ ...params, entity_type: "intervention", entity_id: interventionId })`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| params | `DocumentQueryParams` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<InterventionAttachment>>`

---

### getByArtisan(artisanId, params?)

Shorthand for `getAll({ ...params, entity_type: "artisan", entity_id: artisanId })`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisanId | `string` | Yes | Artisan UUID |
| params | `DocumentQueryParams` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<ArtisanAttachment>>`

---

### getByKind(kind, params?)

Shorthand for `getAll({ ...params, kind })`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| kind | `string` | Yes | Document kind |
| params | `DocumentQueryParams` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<InterventionAttachment | ArtisanAttachment>>`

---

### getSupportedTypes()

Retrieves the list of supported document types from the Edge Function.

**Parameters:** None

**Return:** `Promise<SupportedDocumentTypes>`

---

## Search and Stats

### getByCreator(creatorId, params?)

Retrieves documents created by a specific user via the Edge Function search endpoint.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| creatorId | `string` | Yes | Creator user UUID |
| params | `DocumentQueryParams` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<InterventionAttachment | ArtisanAttachment>>`

---

### searchByFilename(filename, params?)

Searches documents by filename via the Edge Function search endpoint.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| filename | `string` | Yes | Filename to search for |
| params | `DocumentQueryParams` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<InterventionAttachment | ArtisanAttachment>>`

---

### getStats(params?)

Retrieves document statistics from the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params.entity_type | `"intervention" \| "artisan"` | No | Filter by entity type |
| params.entity_id | `string` | No | Filter by entity ID |

**Return:** `Promise<{ total: number; by_type: Record<string, number>; by_entity: Record<string, number>; by_kind: Record<string, number>; total_size: number; recent_count: number }>`

---

## Bulk Operations

### createBulk(documents)

Creates multiple document metadata records sequentially.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| documents | `CreateDocumentData[]` | Yes | Array of documents |

**Return:** `Promise<{ success: number; errors: number; details: Array<{ item, success, data?, error? }> }>`

---

### uploadBulk(files)

Uploads multiple files sequentially.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| files | `FileUploadData[]` | Yes | Array of file upload data |

**Return:** `Promise<{ success: number; errors: number; details: Array<{ item, success, data?, error? }> }>`

---

## Helpers

### normalizeInterventionKind(kind) -- internal

Normalizes document kind values for interventions. Maps variant spellings to canonical forms.

| Input variants | Canonical output |
|---------------|------------------|
| `facture_gmbs`, `factureGMBS`, `facturegmbs` | `facturesGMBS` |
| `facture_artisan`, `facturesArtisan` | `facturesArtisans` |
| `facture_materiel`, `facturesMateriel` | `facturesMateriel` |
| `a_classer`, `a classifier`, etc. | `a_classe` |
