# Cursor AI Rules for GMBS-CRM

> Place these rules in `.cursor/rules/gmbs-crm.md` for automatic context loading.

---

## Project Context

GMBS-CRM is a field intervention management CRM built with Next.js 15 (App Router), React 18, TypeScript 5, Supabase, and TanStack Query 5. It manages interventions, artisans (subcontractors), and clients with a strict workflow state machine.

---

## TypeScript Conventions

- Strict mode is enabled. Never use `any` -- use `unknown` with type guards instead.
- Use `interface` for component props and object shapes.
- Use `type` for unions, intersections, and utility types.
- Path alias: `@/` maps to `./src/`. Always use `@/` for imports across features.
- Never use relative imports across feature boundaries (enforced by ESLint).

```typescript
// CORRECT
import { interventionsApi } from '@/lib/api/v2'
import type { Intervention } from '@/lib/api/v2'

// WRONG -- relative cross-feature import
import { interventionsApi } from '../../../lib/api/v2/interventionsApi'
```

---

## React Component Patterns

### Functional Components Only

```typescript
interface InterventionCardProps {
  intervention: Intervention
  onSelect: (id: string) => void
  isCompact?: boolean
}

export function InterventionCard({ intervention, onSelect, isCompact = false }: InterventionCardProps) {
  // Hook for business logic
  const { canTransition, availableTransitions } = useWorkflowConfig()

  return (
    // JSX
  )
}
```

### Custom Hooks for Logic

Separate data fetching and business logic into custom hooks. Components should only handle rendering.

```typescript
// Hook handles data + logic
function useInterventionDetail(id: string) {
  const { data, isLoading } = useQuery({
    queryKey: interventionKeys.detail(id),
    queryFn: () => interventionsApi.getById(id),
  })
  const { can } = usePermissions()
  const canEdit = can('write_interventions')

  return { intervention: data, isLoading, canEdit }
}

// Component handles rendering
export function InterventionDetail({ id }: { id: string }) {
  const { intervention, isLoading, canEdit } = useInterventionDetail(id)
  if (isLoading) return <Skeleton />
  // render
}
```

### Co-location Pattern (App Router)

Page-specific components and logic live next to their page:

```
app/interventions/
  page.tsx
  [id]/page.tsx
  _components/       # Page-specific components (prefixed with _)
  _lib/              # Page-specific hooks/logic (prefixed with _)
```

Shared components go in `src/components/`. Shared hooks go in `src/hooks/`.

---

## API v2 Patterns

### Always Use the v2 API

```typescript
// CORRECT
import { interventionsApi } from '@/lib/api/v2'
const interventions = await interventionsApi.getAll({ limit: 100, offset: 0 })

// WRONG -- no direct Supabase queries in components
const { data } = await supabase.from('interventions').select('*')
```

### Facade Pattern

The API is organized as a facade with specialized modules:

```typescript
import apiV2 from '@/lib/api/v2'

apiV2.interventions.getAll(params)
apiV2.artisans.getById(id)
apiV2.comments.getByEntity(entityId, entityType)
```

### Intervention Sub-modules

The interventions API is split into 5 modules:
- `interventions-crud.ts` -- CRUD operations
- `interventions-status.ts` -- Status changes, artisan assignment
- `interventions-costs.ts` -- Cost management, margin calculation
- `interventions-stats.ts` -- Dashboard statistics
- `interventions-filters.ts` -- Filter counts and distinct values

All accessed through the unified `interventionsApi` export.

---

## TanStack Query Patterns

### Query Keys Factory

```typescript
import { interventionKeys, artisanKeys, dashboardKeys, referenceKeys } from '@/lib/react-query/queryKeys'

// List with params
const queryKey = interventionKeys.list({ limit: 100, offset: 0, statut: 'INTER_EN_COURS' })

// Detail by ID
const queryKey = interventionKeys.detail(id)

// Invalidation after mutation
queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
```

### Optimistic Updates Pattern

```typescript
const mutation = useMutation({
  mutationFn: (data) => interventionsApi.update(id, data),
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: interventionKeys.lists() })
    const previous = queryClient.getQueryData(queryKey)
    queryClient.setQueriesData({ queryKey: interventionKeys.lists() }, updateFn)
    return { previous }
  },
  onError: (_error, _variables, context) => {
    queryClient.setQueryData(queryKey, context?.previous) // Rollback
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
  },
})
```

### Reference Data

```typescript
// Use the hook for reference data (cached 5min stale, 15min GC)
const { statuses, users, agencies, metiers } = useReferenceDataQuery()

// Or direct cache access in non-React contexts
import { getReferenceCache } from '@/lib/api/v2'
const cache = await getReferenceCache()
const user = cache.users.get(userId)
```

---

## Workflow & Status Transitions

### Never Modify Status Directly

```typescript
// CORRECT -- use workflow validation
import { validateTransition } from '@/lib/workflow-engine'

const result = validateTransition(workflow, fromStatusKey, toStatusKey, context)
if (result.canTransition) {
  await interventionsApi.updateStatus(id, newStatusId)
}

// WRONG -- direct status update
await interventionsApi.update(id, { statut_id: newStatusId })
```

### Status Requirements

Each status has entry requirements that are validated cumulatively:
- DEVIS_ENVOYE: requires devis_id, nom_prenom_facturation, assigned_user
- VISITE_TECHNIQUE: requires artisan
- INTER_EN_COURS: requires artisan, costs, consigne, client info, date_prevue
- INTER_TERMINEE: requires artisan, facture, proprietaire, facture GMBS

---

## Testing Patterns

### Test File Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('ModuleName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('functionName', () => {
    it('should handle nominal case', () => {
      // Arrange
      const input = createMockData()
      // Act
      const result = functionUnderTest(input)
      // Assert
      expect(result).toEqual(expected)
    })

    it('should throw on invalid input', () => {
      expect(() => functionUnderTest(null)).toThrow()
    })
  })
})
```

### Supabase Mock Builder

```typescript
import { SupabaseMockBuilder } from 'tests/__mocks__/supabase/supabase-mock-builder'

const mock = new SupabaseMockBuilder()
  .forTable('interventions', { data: mockInterventions, error: null })
  .forRpc('get_intervention_history', { data: mockHistory, error: null })
  .build()

vi.mock('@/lib/api/v2/common/client', () => ({ supabase: mock }))
```

---

## Common Mistakes to Avoid

1. **Using `any` type** -- Use `unknown` and narrow with type guards.
2. **Direct Supabase queries in components** -- Always go through API v2 layer.
3. **Hardcoded query keys** -- Use the factories in `queryKeys.ts`.
4. **Direct status mutation** -- Use workflow engine for transitions.
5. **Relative imports across features** -- Use `@/` path alias.
6. **Missing tests** -- All new features must include tests.
7. **Local state for server data** -- Use TanStack Query.
8. **Creating new UI primitives** -- Use shadcn/ui components from `src/components/ui/`.
9. **Skipping optimistic updates** -- Use the pattern from `useInterventionsMutations`.
10. **Forgetting to invalidate cache** -- Always invalidate relevant queries after mutations.

---

## UI Framework

- **Primitives**: shadcn/ui (Radix-based) -- `src/components/ui/`
- **Styling**: Tailwind CSS with custom status colors
- **Animations**: Framer Motion (modals, transitions)
- **Forms**: React Hook Form + Zod schemas
- **Icons**: Lucide React
- **Dark mode**: class-based via Tailwind
