# GitHub Copilot Instructions for GMBS-CRM

## Project Overview

GMBS-CRM is a CRM application for managing field interventions, artisans (subcontractors), and clients. It is built for a French company managing building maintenance operations.

## Technical Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 18, Tailwind CSS, shadcn/ui (Radix), Framer Motion
- **State**: TanStack Query 5 (server state), Zustand (client state)
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions)
- **Forms**: React Hook Form + Zod validation
- **Tests**: Vitest + React Testing Library + Playwright

## Code Conventions

### TypeScript
- Strict mode enabled -- no `any` types
- `interface` for props and object shapes
- `type` for unions and utility types
- Path alias: `@/` maps to `./src/`

### React Components
- Functional components only
- Custom hooks for business logic (separate from rendering)
- Props destructured with explicit types
- Co-location: page-specific components in `app/*/\_components/`, shared in `src/components/`

### Imports
```typescript
// Always use path alias
import { interventionsApi } from '@/lib/api/v2'
import type { Intervention } from '@/lib/api/v2'
import { interventionKeys } from '@/lib/react-query/queryKeys'
import { useInterventionsQuery } from '@/hooks/useInterventionsQuery'
```

## Patterns to Follow

### Data Fetching
- Use TanStack Query hooks for all server data
- Query keys from `src/lib/react-query/queryKeys.ts` (factories: `interventionKeys`, `artisanKeys`, `dashboardKeys`, `referenceKeys`)
- Optimistic updates with rollback on error
- Reference data via `useReferenceDataQuery()` hook

### API Layer
- All data access through `src/lib/api/v2/` (facade pattern)
- Available APIs: `interventionsApi`, `artisansApi`, `clientsApi`, `usersApi`, `commentsApi`, `documentsApi`, `rolesApi`, `agenciesApi`, `tenantsApi`, `ownersApi`, `remindersApi`, `enumsApi`
- Never query Supabase directly from components

### Workflow
- Intervention statuses follow a strict state machine (30 transitions)
- Status changes must use `src/lib/workflow/` validation
- Never update `statut_id` directly
- Status flow: DEMANDE -> DEVIS_ENVOYE -> VISITE_TECHNIQUE -> ACCEPTE -> INTER_EN_COURS -> INTER_TERMINEE

### Authentication & Permissions
- Auth via Supabase with HTTP-only cookies
- Current user: `useCurrentUser()` hook
- Permission checks: `usePermissions()` -- provides `can()`, `canAny()`, `canAll()`, `hasRole()`
- Roles: admin, manager, gestionnaire, viewer

### UI Components
- Use shadcn/ui primitives from `src/components/ui/`
- Modal system: GenericModal with halfpage/centerpage/fullpage modes
- 8 view layouts: table, cards, gallery, kanban, calendar, timeline + variants

### Testing
- Every new feature requires tests
- Vitest for unit/integration, Playwright for E2E
- Mock Supabase with `SupabaseMockBuilder`
- Test files: `<source-file>.test.ts` in `tests/unit/`
- Structure: `describe('Module')` > `it('should <behavior>')`

## Patterns to Avoid

- `any` types (use `unknown` with type guards)
- Direct Supabase queries in components (use API v2)
- Hardcoded query key strings (use factories)
- Direct status mutations (use workflow engine)
- Relative imports across features (use `@/`)
- Local state for server data (use TanStack Query)
- Creating new UI primitives (use existing shadcn/ui)
- Skipping tests for new features
- Console.log in production code (removed by build)

## Key Files

| Purpose | Path |
|---------|------|
| API facade | `src/lib/api/v2/index.ts` |
| Interventions API | `src/lib/api/v2/interventions/index.ts` |
| Query keys | `src/lib/react-query/queryKeys.ts` |
| Workflow rules | `src/config/workflow-rules.ts` |
| Status chains | `src/config/intervention-status-chains.ts` |
| Workflow engine | `src/lib/workflow-engine.ts` |
| Realtime sync | `src/lib/realtime/cache-sync.ts` |
| Main query hook | `src/hooks/useInterventionsQuery.ts` |
| Mutations hook | `src/hooks/useInterventionsMutations.ts` |
| Auth hook | `src/hooks/useCurrentUser.ts` |
| Permissions hook | `src/hooks/usePermissions.ts` |
| Type definitions | `src/types/interventions.ts` |
| Test setup | `tests/setup.ts` |
| Supabase mock | `tests/__mocks__/supabase/supabase-mock-builder.ts` |

## Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run test         # Run tests
npm run test:watch   # Tests in watch mode
npm run lint         # ESLint
npm run typecheck    # TypeScript check
```
