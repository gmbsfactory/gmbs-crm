# Interventions API Reference

> Source: `src/lib/api/v2/interventions/` (5 sub-modules unified via facade pattern)

The Interventions API is the core module of the CRM. It is split into 5 sub-modules that are unified into a single `interventionsApi` object via `src/lib/api/v2/interventions/index.ts`.

**Import:**

```typescript
import { interventionsApi } from "@/lib/api/v2";
```

---

## Table of Contents

- [CRUD Operations](#crud-operations)
- [Status and Workflow](#status-and-workflow)
- [Costs and Payments](#costs-and-payments)
- [Statistics and Dashboard](#statistics-and-dashboard)
- [Filters and Counting](#filters-and-counting)

---

## CRUD Operations

Source: `src/lib/api/v2/interventions/interventions-crud.ts`

### getAll(params?)

Retrieves all interventions via the Edge Function `interventions-v2`. Supports filtering, pagination, search, and relation inclusion. Automatically converts metier codes to IDs using the reference cache.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `InterventionQueryParams` | No | Filtering and pagination parameters |
| params.limit | `number` | No | Max results per page (default: 100) |
| params.offset | `number` | No | Pagination offset |
| params.statut | `string` | No | Filter by single status ID |
| params.statuts | `string[]` | No | Filter by multiple status IDs |
| params.agence | `string` | No | Filter by agency ID |
| params.artisan | `string` | No | Filter by artisan ID |
| params.metier | `string` | No | Filter by metier ID or code (case-insensitive) |
| params.metiers | `string[]` | No | Filter by multiple metier IDs or codes |
| params.user | `string \| null` | No | Filter by assigned user ID. Pass `null` for unassigned (Market view) |
| params.startDate | `string` | No | Filter by start date (ISO string) |
| params.endDate | `string` | No | Filter by end date (ISO string) |
| params.isCheck | `boolean` | No | Filter "check" interventions only |
| params.search | `string` | No | Full-text search |
| params.include | `string[]` | No | Relations to include. Available: `artisans`, `costs`, `payments`, `owner`, `tenants`, `users`, `agencies`, `statuses`, `metiers`. Default includes: `artisans`, `costs`, `tenants`, `users`. |

**Return:** `Promise<PaginatedResponse<InterventionWithStatus>>`

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

**Example**

```typescript
const result = await interventionsApi.getAll({
  statut: "INTER_EN_COURS",
  agence: "agency-uuid",
  limit: 50,
  offset: 0,
  include: ["payments", "costs"],
});
// result.data: InterventionWithStatus[]
// result.pagination.total: number
```

---

### getAllLight(params?)

Lightweight version of `getAll` optimized for warm-up. Fetches from the `/interventions/light` endpoint with less data.

**Parameters**

Same as [`getAll`](#getallparams) (except `include` is not supported).

**Return:** `Promise<PaginatedResponse<InterventionWithStatus>>`

**Example**

```typescript
const result = await interventionsApi.getAllLight({ limit: 100 });
```

---

### getTotalCount()

Returns the total number of interventions without loading data. Uses Supabase `head: true` with `count: "exact"`.

**Parameters:** None

**Return:** `Promise<number>`

**Example**

```typescript
const total = await interventionsApi.getTotalCount();
```

---

### getById(id, include?)

Retrieves a single intervention by ID with full relations (status, tenants, owner, artisans, costs, payments).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Intervention UUID |
| include | `string[]` | No | Additional relations to include |

**Return:** `Promise<InterventionWithStatus>`

**Example**

```typescript
const intervention = await interventionsApi.getById("uuid-123");
```

---

### getByIds(ids)

Récupère plusieurs interventions par leurs IDs en une seule requête. Utilisé par la pagination de la page Comptabilité après résolution des IDs triés via le RPC `get_sorted_intervention_ids` (migration `99022`).

**Signature**

```typescript
getByIds(ids: string[]): Promise<InterventionWithStatus[]>
```

**Behavior**

- Retourne `[]` si `ids` est vide (court-circuit, aucun appel réseau)
- L'ordre de retour suit l'ordre Postgres et **n'est pas garanti** identique à `ids` — re-trier côté appelant si nécessaire
- Inclut joins : `status`, `tenants`, `owner`

**Example**

```typescript
const sortedIds = await rpc.getSortedInterventionIds(filters);
const page = sortedIds.slice(offset, offset + pageSize);
const interventions = await interventionsApi.getByIds(page);
```

---

### create(data)

Creates a new intervention. After insertion, automatically creates a status transition chain via `automaticTransitionService`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data | `CreateInterventionData` | Yes | Intervention data to create |

**Return:** `Promise<Intervention>`

**Example**

```typescript
const newIntervention = await interventionsApi.create({
  contexte_intervention: "Fuite d'eau",
  adresse: "12 rue de la Paix",
  agence_id: "agency-uuid",
  statut_id: "status-uuid",
});
```

---

### update(id, data)

Updates an intervention. If `statut_id` changes, records status transitions via `automaticTransitionService`. Admin role check is performed before allowing `contexte_intervention` updates. Recalculates artisan statuses when the intervention enters or leaves a terminated state.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Intervention UUID |
| data | `UpdateInterventionData` | Yes | Fields to update |

**Return:** `Promise<InterventionWithStatus>`

**Example**

```typescript
const updated = await interventionsApi.update("uuid-123", {
  statut_id: "new-status-uuid",
  commentaire_agent: "Updated notes",
});
```

---

### delete(id)

Soft-deletes an intervention via the Edge Function.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Intervention UUID |

**Return:** `Promise<{ message: string; data: Intervention }>`

---

### checkDuplicate(address, agencyId)

Checks if an intervention with the same address and agency already exists.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | `string` | Yes | Address to check |
| agencyId | `string` | Yes | Agency UUID |

**Return:** `Promise<boolean>`

---

### getDuplicateDetails(address, agencyId)

Retrieves details of duplicate interventions for the given address and agency.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | `string` | Yes | Address to check |
| agencyId | `string` | Yes | Agency UUID |

**Return:** `Promise<Array<{ id: string; name: string; address: string; agencyId: string | null; agencyLabel: string | null; managerName: string | null; createdAt: string | null }>>`

---

### upsert(data)

Creates or updates an intervention via the Edge Function upsert endpoint.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data | `CreateInterventionData & { id_inter?: string }` | Yes | Intervention data with optional external ID |

**Return:** `Promise<Intervention>`

---

### upsertDirect(data, customClient?)

Direct Supabase upsert (bypasses Edge Functions). Designed for bulk import operations. Handles conflict on `id_inter` column. Creates automatic status transition chains.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data | `CreateInterventionData & { id_inter?: string }` | Yes | Intervention data |
| customClient | `SupabaseClient` | No | Optional custom Supabase client |

**Return:** `Promise<Intervention>`

---

### createBulk(interventions)

Creates multiple interventions sequentially. Returns a summary of successes and failures.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventions | `CreateInterventionData[]` | Yes | Array of interventions to create |

**Return:** `Promise<BulkOperationResult>`

```typescript
interface BulkOperationResult {
  success: number;
  errors: number;
  details: Array<{
    item: Record<string, unknown>;
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }>;
}
```

---

### getByUser(userId, params?)

Shorthand for `getAll({ ...params, user: userId })`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| params | `InterventionQueryParams` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<Intervention>>`

---

### getByStatus(statusId, params?)

Shorthand for `getAll({ ...params, statut: statusId })`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| statusId | `string` | Yes | Status UUID |
| params | `InterventionQueryParams` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<Intervention>>`

---

### getByAgency(agencyId, params?)

Shorthand for `getAll({ ...params, agence: agencyId })`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| agencyId | `string` | Yes | Agency UUID |
| params | `InterventionQueryParams` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<Intervention>>`

---

### getByArtisan(artisanId, params?)

Retrieves interventions linked to an artisan via the `intervention_artisans` join table. Direct Supabase query (not via Edge Function).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| artisanId | `string` | Yes | Artisan UUID |
| params | `Omit<InterventionQueryParams, "artisan">` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<InterventionWithStatus>>`

---

### getByDateRange(startDate, endDate, params?)

Shorthand for `getAll({ ...params, startDate, endDate })`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| startDate | `string` | Yes | Start date (ISO string) |
| endDate | `string` | Yes | End date (ISO string) |
| params | `InterventionQueryParams` | No | Additional filters |

**Return:** `Promise<PaginatedResponse<Intervention>>`

---

## Status and Workflow

Source: `src/lib/api/v2/interventions/interventions-status.ts`

Uses dependency injection: `_setCrudRef(interventionsCrud)` is called at module initialization to allow `updateStatus` to delegate to `interventionsCrud.update`.

### updateStatus(id, statusId)

Updates the status of an intervention. Delegates to `interventionsCrud.update({ statut_id: statusId })` which handles transition recording and artisan status recalculation.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Intervention UUID |
| statusId | `string` | Yes | New status UUID |

**Return:** `Promise<InterventionWithStatus>`

**Example**

```typescript
const updated = await interventionsApi.updateStatus("inter-uuid", "new-status-uuid");
```

---

### setPrimaryArtisan(interventionId, artisanId)

Sets the primary artisan for an intervention. Handles 5 cases:
1. `artisanId = null` -- removes the current primary
2. Same artisan already primary -- ensures flags are correct
3. Artisan already linked (non-primary) -- promotes to primary, demotes old primary
4. New artisan, existing primary -- demotes old primary to secondary, inserts new as primary
5. New artisan, no existing primary -- inserts new as primary

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| artisanId | `string \| null` | Yes | Artisan UUID or null to remove |

**Return:** `Promise<void>`

---

### setSecondaryArtisan(interventionId, artisanId)

Sets the secondary artisan for an intervention. Throws if the artisan is already the primary.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| artisanId | `string \| null` | Yes | Artisan UUID or null to remove |

**Return:** `Promise<void>`

---

### assignArtisan(interventionId, artisanId, role?, customClient?)

Directly inserts an artisan-intervention link. Used primarily during import operations.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| artisanId | `string` | Yes | Artisan UUID |
| role | `"primary" \| "secondary"` | No | Role (default: `"primary"`) |
| customClient | `SupabaseClient` | No | Optional custom client |

**Return:** `Promise<Record<string, unknown>>`

---

### getAllStatuses()

Retrieves all intervention statuses ordered by `sort_order`.

**Parameters:** None

**Return:** `Promise<InterventionStatus[]>`

```typescript
interface InterventionStatus {
  id: string;
  code: string;
  label: string;
  color: string;
  sort_order: number;
}
```

---

### getStatusByCode(code)

Retrieves a status by its code. Returns `null` if not found.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| code | `string` | Yes | Status code (e.g. `"INTER_EN_COURS"`) |

**Return:** `Promise<InterventionStatus | null>`

---

### getStatusByLabel(label)

Retrieves a status by its label (case-insensitive via `ilike`). Returns `null` if not found.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| label | `string` | Yes | Status label |

**Return:** `Promise<InterventionStatus | null>`

---

### getStatusTransitions(interventionId)

Retrieves the full status transition history for an intervention, ordered by `transition_date` ascending.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |

**Return:** `Promise<InterventionStatusTransition[]>`

---

## Costs and Payments

Source: `src/lib/api/v2/interventions/interventions-costs.ts`

### upsertCost(interventionId, cost)

Creates or updates a single cost entry. Matches on `(intervention_id, cost_type, artisan_order)`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| cost.cost_type | `'sst' \| 'materiel' \| 'intervention' \| 'marge'` | Yes | Cost category |
| cost.amount | `number` | Yes | Amount in EUR |
| cost.artisan_order | `1 \| 2 \| null` | No | Artisan order (default: `null` for intervention/marge, `1` otherwise) |
| cost.label | `string \| null` | No | Optional label |

**Return:** `Promise<void>`

**Example**

```typescript
await interventionsApi.upsertCost("inter-uuid", {
  cost_type: "sst",
  amount: 500,
  artisan_order: 1,
});
```

---

### upsertCostsBatch(interventionId, costs)

Batch version of `upsertCost`. Optimized with a single SELECT to find existing costs, then parallel updates/inserts.

Uses `costMatchKey()` internally: for `intervention`/`marge` types, matches on `cost_type` alone (ignoring `artisan_order`). For `sst`/`materiel`, matches on `cost_type + artisan_order` to distinguish artisan 1 vs 2.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| costs | `Array<{ cost_type, amount, artisan_order?, label? }>` | Yes | Array of costs |

**Return:** `Promise<void>`

---

### getCosts(interventionId, artisanOrder?)

Retrieves all costs for an intervention, optionally filtered by artisan order.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| artisanOrder | `1 \| 2 \| null` | No | Filter by artisan order |

**Return:** `Promise<InterventionCost[]>`

---

### deleteCost(interventionId, costType, artisanOrder?)

Deletes a specific cost entry.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| costType | `string` | Yes | Cost type to delete |
| artisanOrder | `1 \| 2 \| null` | No | Artisan order filter |

**Return:** `Promise<void>`

---

### addCost(interventionId, data)

Inserts a new cost record. Validates UUID format and amount.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| data.cost_type | `"sst" \| "materiel" \| "intervention" \| "marge"` | Yes | Cost type |
| data.amount | `number` | Yes | Amount |
| data.label | `string` | No | Optional label |
| data.currency | `string` | No | Currency (default: `"EUR"`) |
| data.metadata | `Record<string, unknown> \| null` | No | Extra metadata |
| data.artisan_order | `1 \| 2 \| null` | No | Artisan order (default: `null` for intervention/marge, `1` for sst/materiel) |

**Return:** `Promise<InterventionCost>`

---

### addPayment(interventionId, data)

Inserts a new payment record for an intervention.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| data.payment_type | `string` | Yes | Payment type |
| data.amount | `number` | Yes | Amount |
| data.currency | `string` | No | Currency (default: `"EUR"`) |
| data.is_received | `boolean` | No | Whether payment is received (default: `false`) |
| data.payment_date | `string` | No | Payment date |
| data.reference | `string` | No | Payment reference |

**Return:** `Promise<InterventionPayment>`

---

### upsertPayment(interventionId, data)

Creates or updates a payment. Matches on `(intervention_id, payment_type)`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| interventionId | `string` | Yes | Intervention UUID |
| data.payment_type | `string` | Yes | Payment type |
| data.amount | `number` | No | Amount |
| data.currency | `string` | No | Currency |
| data.is_received | `boolean` | No | Received flag |
| data.payment_date | `string \| null` | No | Payment date |
| data.reference | `string \| null` | No | Reference |

**Return:** `Promise<InterventionPayment>`

---

### insertInterventionCosts(costs)

Bulk insert costs for multiple interventions. Uses `upsertCost` internally for each entry.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| costs | `Array<{ intervention_id, cost_type, amount, label?, currency?, metadata?, artisan_order? }>` | Yes | Array of cost entries |

**Return:** `Promise<BulkOperationResult>`

---

### calculateMarginForIntervention(costs, interventionId?)

Synchronously calculates the margin for an intervention from its cost entries.

Formula: `margin = revenue (intervention) - costs (SST + materiel)`

Returns `null` if no costs or `revenue <= 0`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| costs | `InterventionCost[]` | Yes | Array of cost entries |
| interventionId | `string \| number` | No | Used for logging only |

**Return:** `MarginCalculation | null`

```typescript
interface MarginCalculation {
  revenue: number;        // "intervention" cost_type amount
  costs: number;          // SST + materiel total
  margin: number;         // revenue - costs
  marginPercentage: number; // (margin / revenue) * 100
}
```

**Example**

```typescript
const margin = interventionsApi.calculateMarginForIntervention(intervention.intervention_costs);
// { revenue: 1000, costs: 600, margin: 400, marginPercentage: 40 }
```

---

## Statistics and Dashboard

Source: `src/lib/api/v2/interventions/interventions-stats.ts`

Uses dependency injection: `_setCostsRef(interventionsCosts)` is called at module initialization.

### getStatsByUser(userId, startDate?, endDate?)

Retrieves intervention counts grouped by status for a specific user. Includes virtual "Check" status detection.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| startDate | `string` | No | Filter start date (ISO) |
| endDate | `string` | No | Filter end date (ISO) |

**Return:** `Promise<InterventionStatsByStatus>`

```typescript
interface InterventionStatsByStatus {
  total: number;
  by_status: Record<string, number>;
  by_status_label: Record<string, number>;
  interventions_a_checker: number;
  period: { start_date: string | null; end_date: string | null };
}
```

---

### getMarginStatsByUser(userId, startDate?, endDate?)

Retrieves aggregated margin statistics for a user's interventions.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| startDate | `string` | No | Filter start date (ISO) |
| endDate | `string` | No | Filter end date (ISO) |

**Return:** `Promise<MarginStats>`

```typescript
interface MarginStats {
  average_margin_percentage: number;
  total_interventions: number;
  total_revenue: number;
  total_costs: number;
  total_margin: number;
  period: { start_date: string | null; end_date: string | null };
}
```

---

### getMarginRankingByPeriod(startDate?, endDate?)

Retrieves the margin ranking of all gestionnaires for a given period.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| startDate | `string` | No | Period start (ISO) |
| endDate | `string` | No | Period end (ISO) |

**Return:** `Promise<MarginRankingResult>`

---

### getMarginRankingByPeriodV3(startDate?, endDate?)

V3 ranking using the `get_margin_ranking_v3` Supabase RPC. More optimized than V1.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| startDate | `string` | No | Period start (ISO) |
| endDate | `string` | No | Period end (ISO) |

**Return:** `Promise<MarginRankingResult>`

---

### getWeeklyStatsByUser(userId, weekStartDate?)

Retrieves detailed weekly statistics for a user including daily breakdowns.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| weekStartDate | `string` | No | Start of the week (ISO) |

**Return:** `Promise<WeeklyStats>`

---

### getPeriodStatsByUser(userId, period, startDate?)

Retrieves statistics for a user grouped by the specified period type.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| period | `StatsPeriod` (`"week" \| "month" \| "year"`) | Yes | Period grouping |
| startDate | `string` | No | Reference date |

**Return:** `Promise<MonthlyStats>`

---

### getRecentInterventionsByUser(userId, limit?, startDate?, endDate?)

Retrieves recent interventions for a user with cost data for margin calculation.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| limit | `number` | No | Max results (default: `10`) |
| startDate | `string` | No | Filter start date |
| endDate | `string` | No | Filter end date |

**Return:** `Promise<Array<{ id, id_inter, date, address, city, status, margin }>>`

---

### getRecentInterventionsByStatusAndUser(userId, statusLabel, limit?, startDate?, endDate?)

Retrieves recent interventions filtered by status label for tooltip/hover displays.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| statusLabel | `string` | Yes | Status label to filter |
| limit | `number` | No | Max results (default: `5`) |
| startDate | `string` | No | Filter start date |
| endDate | `string` | No | Filter end date |

**Return:** `Promise<Array<{ id, id_inter, date, agence, metier, status, margin }>>`

---

### getAdminDashboardStats(params)

Retrieves comprehensive admin dashboard statistics via the `get_admin_dashboard_stats_v3` Supabase RPC.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `DashboardPeriodParams` | Yes | Period parameters |
| params.startDate | `string` | Yes | Period start |
| params.endDate | `string` | Yes | Period end |
| params.periodType | `PeriodType` | No | Period type |

**Return:** `Promise<AdminDashboardStats>`

---

### getRevenueHistory(params)

Retrieves historical revenue data for KPI charts.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `RevenueHistoryParams` | Yes | History parameters |

**Return:** `Promise<RevenueHistoryResponse>`

---

### getInterventionsHistory(params)

Retrieves historical intervention volume data.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `KPIHistoryParams` | Yes | KPI parameters |

**Return:** `Promise<InterventionsHistoryResponse>`

---

### getTransformationRateHistory(params)

Retrieves historical transformation rate data (requested -> completed ratio).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `KPIHistoryParams` | Yes | KPI parameters |

**Return:** `Promise<TransformationRateHistoryResponse>`

---

### getCycleTimeHistory(params)

Retrieves historical average cycle time data.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `KPIHistoryParams` | Yes | KPI parameters |

**Return:** `Promise<CycleTimeHistoryResponse>`

---

### getMarginHistory(params)

Retrieves historical margin data.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `KPIHistoryParams` | Yes | KPI parameters |

**Return:** `Promise<MarginHistoryResponse>`

---

### calculateLast4Periods(periodType, startDate?, endDate?)

Calculates the last 4 periods relative to the current date.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| periodType | `PeriodType` (`"week" \| "month" \| "year"`) | Yes | Period type |
| startDate | `string` | No | Custom start date |
| endDate | `string` | No | Custom end date |

**Return:** `Array<{ start_date: string; end_date: string; label: string }>`

---

### calculateNextPeriod(periodType, startDate?, endDate?)

Calculates the next period after the given dates.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| periodType | `PeriodType` | Yes | Period type |
| startDate | `string` | No | Reference start date |
| endDate | `string` | No | Reference end date |

**Return:** `{ start_date: string; end_date: string; label: string }`

---

### getWeekNumber(date)

Returns the ISO week number for a given date.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| date | `Date` | Yes | Date to calculate week number for |

**Return:** `number`

---

### calculatePeriodDates(periodType, referenceDate, startDate?, endDate?)

Calculates start and end dates for a period based on a reference date.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| periodType | `PeriodType` | Yes | Period type |
| referenceDate | `Date` | Yes | Reference date |
| startDate | `string` | No | Override start date |
| endDate | `string` | No | Override end date |

**Return:** `{ start_date: string; end_date: string }`

---

## Filters and Counting

Source: `src/lib/api/v2/interventions/interventions-filters.ts`

### getTotalCountWithFilters(params?)

Returns the total count of active interventions matching the given filters. Supports all standard filters plus `isCheck` for virtual "check" status.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `Omit<InterventionQueryParams, "limit" \| "offset" \| "include">` | No | Filters |

**Return:** `Promise<number>`

**Example**

```typescript
const count = await interventionsApi.getTotalCountWithFilters({
  user: "user-uuid",
  statut: "status-uuid",
  isCheck: true,
});
```

---

### getCountsByStatus(params?)

Returns a map of status ID to intervention count. Excludes status and statuts from the base filters.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `Omit<InterventionQueryParams, "limit" \| "offset" \| "include" \| "statut" \| "statuts">` | No | Base filters |

**Return:** `Promise<Record<string, number>>`

**Example**

```typescript
const counts = await interventionsApi.getCountsByStatus({ agence: "agency-uuid" });
// { "status-uuid-1": 12, "status-uuid-2": 5, ... }
```

---

### getCountByPropertyValue(property, value, baseFilters?)

Counts interventions for a specific property value. Wraps `getTotalCountWithFilters`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| property | `'metier' \| 'agence' \| 'statut' \| 'user'` | Yes | Property to filter on |
| value | `string \| null` | Yes | Value to match |
| baseFilters | `Omit<InterventionQueryParams, 'limit' \| 'offset' \| 'include'>` | No | Additional base filters |

**Return:** `Promise<number>`

---

### getFilterCountsGrouped(property, baseFilters?)

Renvoie en **une seule requête RPC** (`get_intervention_filter_counts`) tous les comptages d'interventions groupés par valeur pour une propriété donnée. Remplace N appels successifs à `getCountByPropertyValue` — gain de performance significatif sur les pages avec filtres latéraux.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| property | `'metier' \| 'agence' \| 'statut' \| 'user'` | Yes | Propriété de groupement |
| baseFilters | `Omit<InterventionQueryParams, 'limit' \| 'offset' \| 'include'>` | No | Filtres de base appliqués avant le `GROUP BY` |

**Return:** `Promise<Record<string, number>>` — clé = ID de la valeur (UUID statut/agence/métier/user), valeur = nombre d'interventions.

**Notes**

- Le `metier` passé en `baseFilters` est résolu en UUID via le cache de référence avant l'appel RPC
- Côté DB, le RPC respecte la RLS (le comptage tient compte de l'utilisateur courant)
- Consommé via la query key `interventionKeys.filterCountsByProperty(property, filters)`

---

### getDistinctValues(column, params?)

Returns distinct values for a column. For reference columns (status, user, agency, metier), returns values from the reference cache instead of querying the DB.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| column | `string` | Yes | Column name (e.g. `"statut"`, `"agence"`, `"ville"`, `"code_postal"`) |
| params | `Omit<InterventionQueryParams, "limit" \| "offset" \| "include">` | No | Filters to narrow scope |

**Return:** `Promise<string[]>`

---

### getCountWithFilters(params?)

Alias for `getTotalCountWithFilters`.

**Parameters**

Same as [`getTotalCountWithFilters`](#gettotalcountwithfiltersparams).

**Return:** `Promise<number>`
