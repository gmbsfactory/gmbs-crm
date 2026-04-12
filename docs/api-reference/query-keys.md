# TanStack Query Keys Reference

> Source: `src/lib/react-query/queryKeys.ts`

Centralized query key factories for TanStack Query (React Query). These factories generate hierarchical keys that enable targeted cache invalidation.

**Import:**

```typescript
import {
  interventionKeys,
  artisanKeys,
  dashboardKeys,
  referenceKeys,
  comptabiliteKeys,
  emailLogKeys,
  commentKeys,
  documentKeys,
  analyticsKeys,
  updateKeys,
} from "@/lib/react-query/queryKeys";
```

---

## Table of Contents

- [interventionKeys](#interventionkeys)
- [artisanKeys](#artisankeys)
- [dashboardKeys](#dashboardkeys)
- [referenceKeys](#referencekeys)
- [comptabiliteKeys](#comptabilitekeys)
- [emailLogKeys](#emaillogkeys)
- [commentKeys](#commentkeys)
- [documentKeys](#documentkeys)
- [analyticsKeys](#analyticskeys)
- [updateKeys](#updatekeys)
- [Types](#types)

---

## interventionKeys

Query keys for the interventions domain. Supports full lists, light lists (warm-up), summaries, and detail views.

### Key Hierarchy

```
["interventions"]                              -- all
["interventions", "list"]                      -- lists()
["interventions", "list", params]              -- list(params)
["interventions", "light"]                     -- lightLists()
["interventions", "light", params]             -- lightList(params)
["interventions", "summary"]                   -- summaries()
["interventions", "summary", params]           -- summary(params)
["interventions", "detail"]                    -- details()
["interventions", "detail", id, include]       -- detail(id, include?)
```

### Properties and Methods

| Key | Signature | Output | Description |
|-----|-----------|--------|-------------|
| `all` | (property) | `["interventions"]` | Root key for all intervention queries |
| `lists()` | `() => readonly [...]` | `["interventions", "list"]` | Prefix for full list queries |
| `list(params)` | `(params: InterventionQueryParams) => readonly [...]` | `["interventions", "list", params]` | Key for a specific filtered list |
| `lightLists()` | `() => readonly [...]` | `["interventions", "light"]` | Prefix for light list queries |
| `lightList(params)` | `(params: InterventionQueryParams) => readonly [...]` | `["interventions", "light", params]` | Key for a specific light list |
| `summaries()` | `() => readonly [...]` | `["interventions", "summary"]` | Prefix for summary queries |
| `summary(params)` | `(params: InterventionQueryParams) => readonly [...]` | `["interventions", "summary", params]` | Key for a specific summary |
| `details()` | `() => readonly [...]` | `["interventions", "detail"]` | Prefix for detail queries |
| `detail(id, include?)` | `(id: string, include?: string[]) => readonly [...]` | `["interventions", "detail", id, include]` | Key for a specific intervention detail |
| `filterCounts()` | `() => readonly [...]` | `["interventions", "filter-counts"]` | Prefix for grouped filter counts |
| `filterCountsByProperty(property, filters?)` | `(property: string, filters?: object) => readonly [...]` | `["interventions", "filter-counts", property, filters]` | Counts grouped by metier/agence/statut/user |
| `byArtisan(artisanId)` | `(artisanId: string) => readonly [...]` | `["interventions", "by-artisan", artisanId]` | Interventions assigned to a specific artisan |

### Invalidation Helpers

| Method | Output | Use Case |
|--------|--------|----------|
| `invalidateAll()` | `["interventions"]` | Invalidate everything (nuclear option) |
| `invalidateLists()` | `["interventions", "list"]` | After create/update/delete |
| `invalidateLightLists()` | `["interventions", "light"]` | After data changes affecting light lists |
| `invalidateView(params)` | `[list, lightList, summary]` | Invalidate a specific view (3 keys) |
| `invalidateFilterCounts()` | `["interventions", "filter-counts"]` | After mutations that change grouped counts |

**Example: Invalidate after creation**

```typescript
queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() });
queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLightLists() });
```

**Example: Invalidate specific view**

```typescript
const keys = interventionKeys.invalidateView({
  statut: "INTER_EN_COURS",
  limit: 100,
  offset: 0,
});
keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
```

**Example: Optimistic update**

```typescript
queryClient.setQueriesData(
  { queryKey: interventionKeys.invalidateLists() },
  (oldData) => {
    // Update cached data optimistically
  }
);
```

---

## artisanKeys

Query keys for the artisans domain.

### Key Hierarchy

```
["artisans"]                                   -- all
["artisans", "list"]                           -- lists()
["artisans", "list", params]                   -- list(params)
["artisans", "detail"]                         -- details()
["artisans", "detail", id, include]            -- detail(id, include?)
```

### Properties and Methods

| Key | Signature | Output | Description |
|-----|-----------|--------|-------------|
| `all` | (property) | `["artisans"]` | Root key |
| `lists()` | `() => readonly [...]` | `["artisans", "list"]` | Prefix for list queries |
| `list(params)` | `(params: ArtisanGetAllParams) => readonly [...]` | `["artisans", "list", params]` | Key for a filtered list |
| `details()` | `() => readonly [...]` | `["artisans", "detail"]` | Prefix for detail queries |
| `detail(id, include?)` | `(id: string, include?: string[]) => readonly [...]` | `["artisans", "detail", id, include]` | Key for a specific artisan |

### Invalidation Helpers

| Method | Output | Use Case |
|--------|--------|----------|
| `invalidateAll()` | `["artisans"]` | Invalidate everything |
| `invalidateLists()` | `["artisans", "list"]` | After create/update/delete |
| `invalidateView(params)` | `["artisans", "list", params]` | Invalidate a specific filtered view |

**Example**

```typescript
// After creating an artisan
queryClient.invalidateQueries({ queryKey: artisanKeys.invalidateLists() });

// Fetch with specific filters
const queryKey = artisanKeys.list({
  gestionnaire: "user-id",
  limit: 100,
  offset: 0,
});
```

---

## dashboardKeys

Query keys for dashboard statistics and analytics.

### Key Hierarchy

```
["dashboard"]                                  -- all
["dashboard", "stats"]                         -- stats()
["dashboard", "stats", params]                 -- statsByUser(params)
["dashboard", "margin"]                        -- margin()
["dashboard", "margin", params]                -- marginByUser(params)
["dashboard", "period"]                        -- period()
["dashboard", "period", params]                -- periodStatsByUser(params)
["dashboard", "recent-interventions"]          -- recentInterventions()
["dashboard", "recent-interventions", params]  -- recentInterventionsByStatus(params)
```

### Properties and Methods

| Key | Signature | Output | Description |
|-----|-----------|--------|-------------|
| `all` | (property) | `["dashboard"]` | Root key |
| `stats()` | `() => readonly [...]` | `["dashboard", "stats"]` | Prefix for status stats |
| `statsByUser(params)` | `(params: DashboardStatsParams) => readonly [...]` | `["dashboard", "stats", params]` | Stats for a user/period |
| `margin()` | `() => readonly [...]` | `["dashboard", "margin"]` | Prefix for margin stats |
| `marginByUser(params)` | `(params: DashboardMarginParams) => readonly [...]` | `["dashboard", "margin", params]` | Margin stats for a user |
| `period()` | `() => readonly [...]` | `["dashboard", "period"]` | Prefix for period stats |
| `periodStatsByUser(params)` | `(params: DashboardPeriodStatsParams) => readonly [...]` | `["dashboard", "period", params]` | Period stats for a user |
| `recentInterventions()` | `() => readonly [...]` | `["dashboard", "recent-interventions"]` | Prefix for recent interventions |
| `recentInterventionsByStatus(params)` | `(params: { userId, statusLabel, limit?, startDate?, endDate? }) => readonly [...]` | `["dashboard", "recent-interventions", params]` | Recent by status |
| `marginRanking()` | `() => readonly [...]` | `["dashboard", "margin-ranking"]` | Prefix for margin ranking |
| `marginRankingByPeriod(params)` | `(params: { startDate, endDate }) => readonly [...]` | `["dashboard", "margin-ranking", params]` | Margin ranking for a period |

### Invalidation Helpers

| Method | Output | Use Case |
|--------|--------|----------|
| `invalidateAll()` | `["dashboard"]` | Invalidate all dashboard data |
| `invalidateStats(queryClient)` | (executes 3 invalidations) | Invalidates stats + margin + period sub-trees. **Note:** unlike other invalidate helpers, this takes a `QueryClient` and runs the invalidations itself. |

**Example**

```typescript
// Invalidate all dashboard stats after an intervention update
queryClient.invalidateQueries({ queryKey: dashboardKeys.invalidateAll() });

// Get margin stats key
const marginKey = dashboardKeys.marginByUser({
  userId: "user-uuid",
  startDate: "2024-01-01",
  endDate: "2024-01-31",
});
```

---

## referenceKeys

Query keys for reference/settings data (statuses, users, agencies, metiers).

### Key Hierarchy

```
["references"]                                 -- all
["references", "all"]                          -- allData()
["references", "statuses"]                     -- statuses()
["references", "users"]                        -- users()
["references", "agencies"]                     -- agencies()
["references", "metiers"]                      -- metiers()
```

### Properties and Methods

| Key | Signature | Output | Description |
|-----|-----------|--------|-------------|
| `all` | (property) | `["references"]` | Root key |
| `allData()` | `() => readonly [...]` | `["references", "all"]` | Key for all reference data combined |
| `statuses()` | `() => readonly [...]` | `["references", "statuses"]` | Key for intervention statuses |
| `users()` | `() => readonly [...]` | `["references", "users"]` | Key for users reference |
| `agencies()` | `() => readonly [...]` | `["references", "agencies"]` | Key for agencies reference |
| `metiers()` | `() => readonly [...]` | `["references", "metiers"]` | Key for metiers reference |
| `artisanStatuses()` | `() => readonly [...]` | `["references", "artisan-statuses"]` | Key for artisan statuses reference |

### Invalidation Helpers

| Method | Output | Use Case |
|--------|--------|----------|
| `invalidateAll()` | `["references"]` | After bulk import or settings change |

**Example**

```typescript
// Invalidate all reference data after an import
queryClient.invalidateQueries({ queryKey: referenceKeys.invalidateAll() });
```

---

## comptabiliteKeys

Query keys for the comptabilité (accounting) page — interventions filtered by date range with cost/payment data.

### Key Hierarchy

```
["comptabilite"]                               -- all
["comptabilite", "list"]                       -- lists()
["comptabilite", "list", params]               -- list(params)
["comptabilite", "checks"]                     -- checks()
["comptabilite", "checks", params]             -- checksByDateRange(params)
```

### Properties and Methods

| Key | Signature | Output | Description |
|-----|-----------|--------|-------------|
| `all` | (property) | `["comptabilite"]` | Root key |
| `lists()` | `() => readonly [...]` | `["comptabilite", "list"]` | Prefix for list queries |
| `list(params)` | `(params: ComptabiliteQueryParams) => readonly [...]` | `["comptabilite", "list", params]` | Filtered list (date range + pagination) |
| `checks()` | `() => readonly [...]` | `["comptabilite", "checks"]` | Prefix for check-state queries |
| `checksByDateRange(params)` | `(params: ComptabiliteQueryParams) => readonly [...]` | `["comptabilite", "checks", params]` | Check states for a date range |

### Invalidation Helpers

| Method | Output | Use Case |
|--------|--------|----------|
| `invalidateAll()` | `["comptabilite"]` | Nuclear option |
| `invalidateLists()` | `["comptabilite", "list"]` | After cost/payment change |
| `invalidateChecks()` | `["comptabilite", "checks"]` | After "Copier + Check" toggle |

> Consumed by `useComptabiliteQuery`.

---

## emailLogKeys

Query keys for email send logs (devis / convocation visite technique).

```
["email-logs"]                                                       -- all
["email-logs", "intervention", interventionId]                       -- byIntervention(id)
["email-logs", "intervention", interventionId, "type", emailType]    -- byInterventionAndType(id, type)
```

| Method | Description |
|--------|-------------|
| `byIntervention(interventionId)` | All email logs for an intervention |
| `byInterventionAndType(interventionId, "devis" \| "intervention")` | Logs filtered by email type |
| `invalidateByIntervention(interventionId)` | Invalidate all logs for an intervention |
| `invalidateAll()` | Invalidate all email logs |

---

## commentKeys

Query keys for entity comments. Compatible with the existing `["comments", entityType, entityId, limit]` shape used by `CommentSection`.

```
["comments"]                                                  -- all
["comments", entityType, entityId]                            -- byEntity(...)
["comments", entityType, entityId, limit]                     -- byEntityPaginated(...)
```

| Method | Description |
|--------|-------------|
| `byEntity(entityType, entityId)` | Prefix matching all paginations for an entity |
| `byEntityPaginated(entityType, entityId, limit)` | Exact key for a specific page size |
| `invalidateByEntity(entityType, entityId)` | Invalidate all comments for an entity |
| `invalidateAll()` | Invalidate every comment query |

> The `entityType` is typically `'intervention'` or `'artisan'`.

---

## documentKeys

Query keys for entity-attached documents.

```
["documents"]                              -- all
["documents", entityType, entityId]        -- byEntity(...)
```

| Method | Description |
|--------|-------------|
| `byEntity(entityType, entityId)` | Documents for a given entity |
| `invalidateByEntity(entityType, entityId)` | Invalidate after upload/delete |
| `invalidateAll()` | Invalidate every document query |

---

## analyticsKeys

Query keys for the analytics dashboard (separate from the operational dashboard).

```
["analytics"]                              -- all
["analytics", "dashboard"]                 -- dashboard()
```

| Method | Description |
|--------|-------------|
| `dashboard()` | Key for the analytics dashboard payload |
| `invalidateAll()` | Invalidate every analytics query |

> Consumed by `analyticsApi` (`src/lib/api/v2/analyticsApi.ts`).

---

## updateKeys

Query keys for in-app update notifications (the changelog / "what's new" feature).

```
["app-updates"]                            -- all
["app-updates", "unseen"]                  -- unseen()
["app-updates", "journal"]                 -- journal()
["app-updates", "admin"]                   -- admin()
["app-updates", "admin", "with-views"]     -- adminWithViews()
```

| Method | Description |
|--------|-------------|
| `unseen()` | Updates the current user has not yet seen |
| `journal()` | Full changelog journal |
| `admin()` | Admin view of all updates |
| `adminWithViews()` | Admin view enriched with view counts per update |

---

## Types

### InterventionQueryParams (alias: GetAllParams)

```typescript
interface InterventionQueryParams {
  limit?: number;
  offset?: number;
  statut?: string;
  statuts?: string[];
  agence?: string;
  artisan?: string;
  metier?: string;
  metiers?: string[];
  user?: string | null;
  startDate?: string;
  endDate?: string;
  isCheck?: boolean;
  search?: string;
  include?: string[];
}
```

### ArtisanGetAllParams

```typescript
type ArtisanGetAllParams = {
  limit?: number;
  offset?: number;
  statut?: string;
  statuts?: string[];
  metier?: string;
  metiers?: string[];
  zone?: string;
  gestionnaire?: string;
  search?: string;
  statut_dossier?: string;
};
```

### DashboardStatsParams

```typescript
type DashboardStatsParams = {
  userId: string;
  startDate?: string;
  endDate?: string;
};
```

### DashboardMarginParams

```typescript
type DashboardMarginParams = {
  userId: string;
  startDate: string;
  endDate: string;
};
```

### DashboardPeriodStatsParams

```typescript
type DashboardPeriodStatsParams = {
  userId: string;
  period: "week" | "month" | "year";
  startDate?: string;
};
```

### ComptabiliteQueryParams

```typescript
type ComptabiliteQueryParams = {
  dateStart?: string;
  dateEnd?: string;
  page?: number;
  pageSize?: number;
};
```
