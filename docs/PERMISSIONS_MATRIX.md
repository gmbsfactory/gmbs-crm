# Permissions Matrix (Page + Action)

## Scope
- Sources: `app/**/page.tsx`, `app/api/**/route.ts`, `src/components/**`, `src/features/settings/**`.
- This matrix describes the target permission model (what should be required). Current enforcement is called out separately.

## Permission keys (current)
- read_interventions
- write_interventions
- delete_interventions
- edit_closed_interventions
- read_artisans
- write_artisans
- delete_artisans
- export_artisans
- read_users
- write_users
- delete_users
- manage_roles
- manage_settings
- view_admin
- view_comptabilite

## Page access matrix
| Page | Required permission(s) | Current enforcement | Notes |
| --- | --- | --- | --- |
| `/login` | public | public | Public auth page |
| `/landingpage` | public | public | Public landing page |
| `/dashboard` | read_interventions | token only (middleware) | General dashboard, no role guard |
| `/interventions` | read_interventions | token only (middleware) | List + views |
| `/interventions/new` | write_interventions | token only (middleware) | Create form |
| `/interventions/[id]` | read_interventions (view), write_interventions (edit) | token only (middleware) | Context edit is admin-only in API |
| `/artisans` | read_artisans | token only (middleware) | List + modal |
| `/comptabilite` | view_comptabilite | UI role + page_permissions check | Uses `page_permissions.comptabilite` override |
| `/settings/profile` | self | none | Profile settings |
| `/settings/interface` | self | none | UI preferences |
| `/settings/security` | self | none | Placeholder tab |
| `/settings/team` | write_users (page access), delete_users/manage_roles (actions) | UI admin-only tab | API uses service role (no checks). Note: gestionnaire has read_users for selectors but not page access. |
| `/settings/enums` | manage_settings | UI admin-only tab | Settings-only access |
| `/settings/targets` | admin or manager | UI role check + RLS on table | Consider manage_targets permission |
| `/settings/interface/workflow` | manage_settings | none | Route is not guarded |
| `/admin/dashboard` | view_admin | AdminGuard (UI) | Admin-only module |
| `/admin/analytics` | view_admin | AdminGuard (UI) | Admin-only module |
| `/artisans-ultra`, `/interventions-ultra`, `/testmodalui`, `/previews/*` | same as main pages | none | Internal/dev pages |

## Action matrix
| Domain | Action | Permission | API route(s) | UI entry point(s) | Current enforcement |
| --- | --- | --- | --- | --- | --- |
| Interventions | List/search/filter | read_interventions | `app/api/interventions/route.ts` (GET) | `app/interventions/page.tsx` | none |
| Interventions | Create | write_interventions | `app/api/interventions/route.ts` (POST) | `app/interventions/new/page.tsx`, `src/components/interventions/NewInterventionForm.tsx` | none |
| Interventions | Update (general) | write_interventions | `app/api/interventions/[id]/route.ts` (PATCH) | `src/components/interventions/InterventionEditForm.tsx` | none |
| Interventions | Edit context after create | admin-only (permission missing) | `app/api/interventions/[id]/route.ts` (PATCH) | `src/components/interventions/InterventionForm.tsx` | role check in API only |
| Interventions | Edit closed | edit_closed_interventions | `app/api/interventions/[id]/route.ts` (PATCH) | `src/components/interventions/InterventionEditForm.tsx` | none |
| Interventions | Delete | delete_interventions | `app/api/interventions/[id]/route.ts` (DELETE) | `src/components/interventions/InterventionContextMenu.tsx` | none |
| Interventions | Duplicate (devis supp) | write_interventions | `app/api/interventions/[id]/duplicate/route.ts` (POST) | `src/components/interventions/InterventionContextMenu.tsx` | none |
| Interventions | Assign to me | write_interventions | `app/api/interventions/[id]/assign/route.ts` (POST) | `src/components/interventions/InterventionContextMenu.tsx` | token only |
| Interventions | Status transition | write_interventions | `app/api/interventions/[id]/status/route.ts` (POST) | `src/components/interventions/InterventionContextMenu.tsx` | none |
| Interventions | Duplicates check | read_interventions | `app/api/interventions/duplicates/route.ts` (POST) | `src/hooks/useInterventionForm.ts` | none |
| Interventions | Upload document | write_interventions | `app/api/interventions/[id]/documents/route.ts` (POST) | `src/components/documents/DocumentManager.tsx` | none |
| Interventions | Delete document | write_interventions | `app/api/interventions/[id]/documents/[documentId]/route.ts` (DELETE) | `src/components/documents/DocumentManager.tsx` | none |
| Interventions | Send email to artisan | write_interventions | `app/api/interventions/[id]/send-email/route.ts` (POST) | `src/components/interventions/InterventionForm.tsx` | token only |
| Interventions | Search artisans for assignment | read_artisans | `app/api/interventions/artisans/search/route.ts` (POST) | `src/components/interventions/InterventionForm.tsx` | none |
| Interventions | Invoice preview | write_interventions | `app/api/interventions/invoice/route.ts` (POST) | `src/components/interventions/InterventionForm.tsx` | none |
| Artisans | List/search/filter | read_artisans | (via `artisansApi`) | `app/artisans/page.tsx` | none |
| Artisans | Create | write_artisans | (via `artisansApi`) | `src/components/ui/artisan-modal/NewArtisanModalContent.tsx` | none |
| Artisans | Update | write_artisans | (via `artisansApi`) | `src/components/ui/artisan-modal/ArtisanModalContent.tsx` | none |
| Artisans | Archive | write_artisans | `app/api/artisans/[id]/archive/route.ts` (POST) | `src/hooks/useArtisanContextMenu.ts` | token only |
| Artisans | Delete | delete_artisans | (via `artisansApi`) | `app/artisans/page.tsx` | none |
| Artisans | Recalculate status | manage_settings | `app/api/artisans/[id]/recalculate-status/route.ts` (POST) | none | none |
| Artisans | Export (scripts) | export_artisans | `scripts/exports/export-to-sheets.js` | CLI only | n/a |
| Users/Team | List users | read_users | `app/api/settings/team/route.ts` (GET) | `src/features/settings/SettingsRoot.tsx` | UI admin-only tab |
| Users/Team | Create user | write_users | `app/api/settings/team/user/route.ts` (POST) | `src/features/settings/SettingsRoot.tsx` | UI admin-only tab |
| Users/Team | Update user | write_users | `app/api/settings/team/user/route.ts` (PATCH) | `src/features/settings/SettingsRoot.tsx` | UI admin-only tab |
| Users/Team | Delete user | delete_users | `app/api/settings/team/user/route.ts` (DELETE) | `src/features/settings/SettingsRoot.tsx` | UI admin-only tab |
| Users/Team | Assign role | manage_roles | `app/api/settings/team/role/route.ts` (POST) | `src/features/settings/SettingsRoot.tsx` | UI admin-only tab |
| Users/Team | Set page permissions | manage_roles | `app/api/settings/team/user/[userId]/page-permissions/route.ts` (POST) | `src/features/settings/SettingsRoot.tsx` | UI admin-only tab |
| Settings | Agencies CRUD | manage_settings | `app/api/settings/agency/*.ts` | `src/features/settings/SettingsRoot.tsx` | UI admin-only tab |
| Settings | Metiers CRUD | manage_settings | `app/api/settings/metiers/*.ts` | `src/features/settings/SettingsRoot.tsx` | UI admin-only tab |
| Settings | Intervention statuses CRUD | manage_settings | `app/api/settings/intervention-statuses/*.ts` | `src/features/settings/SettingsRoot.tsx` | UI admin-only tab |
| Settings | Workflow editor | manage_settings | n/a | `app/settings/interface/workflow/page.tsx` | none |
| Settings | Targets (gestionnaire targets) | admin or manager (role) | (RLS in `supabase/migrations/00009_gestionnaire_targets.sql`) | `src/features/settings/TargetsSettings.tsx` | role + RLS |
| Admin | Dashboard | view_admin | `supabase rpc get_admin_dashboard_stats*` | `app/admin/dashboard/page.tsx` | AdminGuard (UI) |
| Admin | Analytics (AI) | view_admin | `app/api/admin/analytics/ai/route.ts` | `app/admin/analytics/page.tsx` | AdminGuard (UI) |

## Gaps / follow-ups
- Most API routes lack permission checks and many use `supabaseAdmin` (bypass RLS). Plan to enforce permissions server-side.
- Consider a specific permission for context edit (currently admin role check only).
- Decide whether `manage_targets` should exist or keep admin/manager role checks for targets.
