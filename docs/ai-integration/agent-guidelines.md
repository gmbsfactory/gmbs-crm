# Agent Guidelines for GMBS-CRM

Guidelines for AI agents (Claude Code, Cursor, Copilot) working on the GMBS-CRM codebase.

---

## Navigating the Codebase

### Entry Points

Start with these files to understand the project:

1. **`CLAUDE.md`** (project root) -- Development conventions, test policy, critical files
2. **`src/lib/api/v2/index.ts`** -- API facade, all available APIs and types
3. **`src/lib/react-query/queryKeys.ts`** -- Query key factories for TanStack Query
4. **`src/config/workflow-rules.ts`** -- Intervention status transitions and rules
5. **`src/types/interventions.ts`** -- Core Zod schemas and type definitions

### Directory Map

```
app/                        # Pages and API routes (Next.js App Router)
  (auth)/                   # Auth pages (login, set-password)
  interventions/            # Intervention pages + _components/ + _lib/
  artisans/                 # Artisan pages + _components/ + _lib/
  admin/                    # Admin dashboard
  api/                      # Next.js API routes (auth, settings)

src/
  components/               # Shared React components
    ui/                     # shadcn/ui primitives (button, card, dialog, etc.)
    ui/intervention-modal/  # Intervention modal system
    ui/artisan-modal/       # Artisan modal system
    layout/                 # Layout components (sidebar, topbar, auth-guard)
    interventions/          # Intervention-specific components
    artisans/               # Artisan-specific components
  hooks/                    # 67 custom hooks (see categories below)
  lib/
    api/v2/                 # API layer (29 modules, facade pattern)
    api/v2/common/          # Shared: types, client, cache, utils, constants
    api/v2/interventions/   # 5 intervention sub-modules
    realtime/               # Realtime sync, cache-sync, broadcast, offline queue
    workflow/               # Cumulative validation
    workflow-engine.ts      # Transition validator
    workflow-persistence.ts # Workflow state persistence
  config/                   # Business rules, workflow, status colors
  contexts/                 # 9 React contexts
  stores/                   # Zustand stores (settings)
  types/                    # 11 type definition files

supabase/
  functions/                # 13 Deno Edge Functions
  migrations/               # 82 SQL migrations

tests/
  __fixtures__/             # Mock data factories
  __mocks__/                # Supabase mock builder
  unit/                     # Unit tests (~48 files)
  integration/              # Integration tests
  e2e/                      # Playwright E2E tests
```

### Hook Categories

When looking for a hook, check by category:

| Category | Key Hooks |
|----------|-----------|
| Data Fetching | `useInterventionsQuery`, `useArtisansQuery`, `useReferenceDataQuery`, `useDashboardStats` |
| Mutations | `useInterventionsMutations` |
| Auth | `useCurrentUser`, `usePermissions`, `useUserRoles` |
| Modals | `useModal`, `useInterventionModal`, `useArtisanModal`, `useModalState` |
| Forms | `useInterventionForm`, `useFormDataChanges` |
| Views | `useInterventionViews`, `useArtisanViews`, `useSmartFilters` |
| Realtime | `useInterventionsRealtime`, `usePreloadInterventions` |
| Context Menu | `useInterventionContextMenu`, `useArtisanContextMenu` |
| Reference Maps | `useInterventionStatusMap`, `useUserMap`, `useMetierMap` |
| Utilities | `useDebounce`, `useInfiniteScroll`, `usePagination`, `useKeyboardShortcuts` |

---

## Critical Files -- Do Not Break

These files form the core of the system. Any modification MUST include corresponding tests:

| File | Risk Level | Required Test Coverage |
|------|-----------|----------------------|
| `src/lib/api/v2/interventions/*.ts` | Critical | 80%+ |
| `src/lib/workflow/` | Critical | 100% |
| `src/lib/workflow-engine.ts` | Critical | 100% |
| `src/config/workflow-rules.ts` | Critical | 100% |
| `src/lib/realtime/cache-sync*.ts` | Critical | 80%+ |
| `src/hooks/useInterventionsQuery.ts` | High | 80%+ |
| `src/hooks/usePermissions.ts` | High | 80%+ |
| `src/hooks/useInterventionForm.ts` | High | 80%+ |
| `src/lib/api/v2/common/cache.ts` | High | 80%+ |
| `supabase/functions/` | Medium | 60%+ |

Before modifying these files:
1. Read the existing tests in `tests/unit/`
2. Run the existing test suite: `npm run test`
3. Write tests for your changes FIRST (TDD)
4. Verify no regressions after your changes

---

## Pre-Submission Checklist

Before completing any task, verify:

- [ ] **TypeScript compiles**: `npm run typecheck`
- [ ] **Linter passes**: `npm run lint`
- [ ] **All tests pass**: `npm run test`
- [ ] **No regressions**: existing test count has not decreased
- [ ] **New tests written**: for any new logic or modified behavior
- [ ] **No `any` types**: use `unknown` with type guards
- [ ] **API v2 only**: no direct Supabase queries in components
- [ ] **Query keys from factory**: no hardcoded strings
- [ ] **Path alias used**: `@/` imports, no relative cross-feature imports
- [ ] **No sensitive data**: no credentials, .env values, or client data in code

---

## Exploration Patterns

### Finding Where Something Is Used

```bash
# Find all files importing a module
grep -r "from '@/lib/api/v2'" src/ --include="*.ts" --include="*.tsx"

# Find all uses of a hook
grep -r "useInterventionsQuery" src/ --include="*.ts" --include="*.tsx"

# Find components using a specific prop
grep -r "entityType.*intervention" src/components/ --include="*.tsx"
```

### Understanding a Feature

1. Start with the page: `app/<feature>/page.tsx`
2. Check co-located components: `app/<feature>/_components/`
3. Check co-located logic: `app/<feature>/_lib/`
4. Check shared hooks: `src/hooks/use<Feature>*.ts`
5. Check API module: `src/lib/api/v2/<feature>Api.ts`
6. Check types: `src/types/<feature>.ts`

### Understanding the Data Flow

```
User Action
  -> React Component (render only)
  -> Custom Hook (business logic)
  -> TanStack Query (cache + fetching)
  -> API v2 Module (data access)
  -> Supabase Edge Function or Direct Query
  -> PostgreSQL

Realtime Update:
  PostgreSQL -> Supabase Realtime -> cache-sync.ts -> TanStack Query cache -> Component re-render
```

---

## Writing Tests for This Project

### Test Location

Match the source file path:
- `src/lib/api/v2/interventions/interventions-crud.ts` -> `tests/unit/lib/interventions/interventions-crud.test.ts`
- `src/hooks/usePermissions.ts` -> `tests/unit/hooks/usePermissions.test.ts`
- `src/config/workflow-rules.ts` -> `tests/unit/config/workflow-rules.test.ts`

### Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies BEFORE importing the module under test
vi.mock('@/lib/api/v2/common/client', () => ({
  supabase: mockSupabase,
}))

import { functionUnderTest } from '@/path/to/module'

describe('ModuleName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('functionName', () => {
    it('should return expected result for valid input', () => {
      // Arrange
      const input = { /* mock data */ }

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toEqual(expectedOutput)
    })

    it('should handle edge case', () => {
      // Arrange + Act + Assert
      expect(() => functionUnderTest(null)).toThrow()
    })
  })
})
```

### Mocking Supabase

```typescript
import { SupabaseMockBuilder } from 'tests/__mocks__/supabase/supabase-mock-builder'

const mockSupabase = new SupabaseMockBuilder()
  .forTable('interventions', {
    data: [{ id: '1', statut_id: 'uuid-demande' }],
    error: null,
  })
  .forRpc('get_intervention_history', {
    data: [{ action_type: 'status_change' }],
    error: null,
  })
  .build()
```

### Mock Fixtures

Use factories from `tests/__fixtures__/interventions.ts` to generate test data. Create similar factories for new entity types.

### What to Test (Priority)

| Priority | What | Coverage Target |
|----------|------|----------------|
| Critical | Workflow transitions and validation | 100% |
| Critical | Margin and cost calculations | 100% |
| High | API module functions | 80%+ |
| High | Custom hooks with business logic | 80%+ |
| Medium | Components with conditional rendering | 60%+ |
| Low | Pure UI components | Optional |

---

## Common Patterns Reference

### Creating a New API Endpoint

1. Add the function to the appropriate API module in `src/lib/api/v2/`
2. Export it from the module's index
3. Add query key to `src/lib/react-query/queryKeys.ts` if it's a query
4. Create or update the corresponding hook in `src/hooks/`
5. Write tests in `tests/unit/lib/`

### Adding a New Page

1. Create `app/<route>/page.tsx`
2. Add `_components/` and `_lib/` directories for co-located code
3. Add permission check via `usePermissions()` or `<PermissionGate>`
4. Register in sidebar navigation if needed (`src/components/layout/app-sidebar.tsx`)

### Adding a Status Transition

1. Add the transition to `src/config/workflow-rules.ts` (AUTHORIZED_TRANSITIONS)
2. Define entry requirements if the target status needs them
3. Update cumulative validation in `src/lib/workflow/cumulative-validation.ts` if needed
4. Write tests covering the new transition
5. Test both valid and invalid transition paths
