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
} from "@/lib/react-query/queryKeys";
```

---

## Table of Contents

- [interventionKeys](#interventionkeys)
- [artisanKeys](#artisankeys)
- [dashboardKeys](#dashboardkeys)
- [referenceKeys](#referencekeys)
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

### Invalidation Helpers

| Method | Output | Use Case |
|--------|--------|----------|
| `invalidateAll()` | `["interventions"]` | Invalidate everything (nuclear option) |
| `invalidateLists()` | `["interventions", "list"]` | After create/update/delete |
| `invalidateLightLists()` | `["interventions", "light"]` | After data changes affecting light lists |
| `invalidateView(params)` | `[list, lightList, summary]` | Invalidate a specific view (3 keys) |

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

### Invalidation Helpers

| Method | Output | Use Case |
|--------|--------|----------|
| `invalidateAll()` | `["dashboard"]` | Invalidate all dashboard data |
| `invalidateStats()` | `["dashboard", "stats", "margin", "period"]` | After intervention modification |

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
