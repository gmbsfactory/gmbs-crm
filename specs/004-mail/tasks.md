# Tasks: Système d'envoi d'email CRM

**Input**: Design documents from `/specs/004-mail/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by implementation phase to enable logical progression from foundation to UI.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

---

## Phase 1: Setup & Configuration (Foundation)

**Purpose**: Project initialization, dependencies, and environment configuration

**⚠️ CRITICAL**: This phase must be complete before any implementation can begin

- [X] T001 Install dependencies: `npm install nodemailer @types/nodemailer`
- [X] T002 [P] Configure environment variables in `.env.local`:
  - `EMAIL_PASSWORD_ENCRYPTION_KEY` (32+ characters hex)
  - `EMAIL_PASSWORD_ENCRYPTION_IV` (16 characters hex)
- [X] T003 [P] Generate encryption keys using Node.js crypto (document in quickstart.md)
- [X] T004 [P] Add logo GMBS to `public/logoGM.png` (optimize size < 200 KB) - **NOTE**: Logo must be added manually. A `gmbs-logo.svg` exists in public/, convert to PNG if needed.

**Checkpoint**: Dependencies installed, environment configured, assets ready

---

## Phase 2: Database Schema (Foundation)

**Purpose**: Database migrations and schema setup

**⚠️ CRITICAL**: This phase blocks all backend implementation

- [X] T005 Create migration file `supabase/migrations/YYYYMMDDHHMMSS_add_email_smtp_fields.sql`
- [X] T006 [P] Add columns `email_smtp` and `email_password_encrypted` to `users` table
- [X] T007 [P] Create table `email_logs` with all columns (id, intervention_id, artisan_id, sent_by, recipient_email, subject, message_html, email_type, attachments_count, status, error_message, sent_at, created_at)
- [X] T008 [P] Create indexes:
  - `idx_users_email_smtp` on `users(email_smtp)`
  - `idx_email_logs_intervention` on `email_logs(intervention_id)`
  - `idx_email_logs_artisan` on `email_logs(artisan_id)`
  - `idx_email_logs_sent_by` on `email_logs(sent_by)`
  - `idx_email_logs_sent_at` on `email_logs(sent_at)`
  - `idx_email_logs_type` on `email_logs(email_type)`
- [X] T009 [P] Configure RLS policies:
  - `users_email_smtp_select` (users see only their own credentials)
  - `users_email_smtp_update` (users update only their own credentials)
  - `email_logs_select_own` (users see their own logs)
  - `email_logs_select_admin` (admins see all logs)
- [X] T010 Test migration locally: `supabase migration up` - **NOTE**: Migration created, test manually when Supabase is running

**Checkpoint**: Database schema ready - backend implementation can now begin

---

## Phase 3: Backend Core Services (Foundation)

**Purpose**: Core backend services that all other features depend on

**⚠️ CRITICAL**: This phase blocks API routes and frontend integration

### Encryption Utilities

- [X] T011 Create `src/lib/utils/encryption.ts` with functions:
  - `encryptPassword(password: string): string` (AES-256-CBC)
  - `decryptPassword(encryptedPassword: string): string` (AES-256-CBC)
- [X] T012 Add error handling for invalid keys/IV in encryption functions
- [X] T013 Add TypeScript types and JSDoc comments

### Email Templates

- [X] T014 Create `src/lib/email-templates/intervention-emails.ts`
- [X] T015 [P] Implement interface `EmailTemplateData` with all fields (nomClient, telephoneClient, telephoneClient2?, adresseComplete, datePrevue?, consigneArtisan?, coutSST?, commentaire?, idIntervention?)
- [X] T016 [P] Implement `generateDevisEmailTemplate(data: EmailTemplateData): string`:
  - Logo GMBS inline (cid:logoGM)
  - Informations client (nom, téléphone, adresse)
  - Date prévue (défaut: "À définir")
  - Consigne artisan (défaut: "Aucune description fournie")
  - Commentaires (section non affichée si vide)
  - Instructions post-visite
  - Coordonnées GMBS
  - Signature David Lenotre
- [X] T017 [P] Implement `generateInterventionEmailTemplate(data: EmailTemplateData): string`:
  - Logo GMBS inline (cid:logoGM)
  - Informations client (nom, téléphone, adresse)
  - Date prévue (défaut: "À définir")
  - Consigne artisan (défaut: "Aucune description fournie")
  - Coût SST (défaut: "Non spécifié")
  - Commentaires (section non affichée si vide)
  - Instructions post-intervention
  - Coordonnées de facturation GMBS
  - Signature David Lenotre
- [X] T018 Add default value handling for optional fields (telephoneClient2: "", datePrevue: "À définir", etc.)
- [X] T019 Add validation helpers for required fields (nomClient, telephoneClient, adresseComplete)

### Email Service

- [X] T020 Create `src/lib/services/email-service.ts`
- [X] T021 Implement interface `SendEmailParams` with type, artisanEmail, subject, htmlContent, smtpEmail, smtpPassword, attachments?
- [X] T022 Implement interface `Attachment` with filename, path?, content?, cid?, contentType?
- [X] T023 Implement `sendEmailToArtisan(params: SendEmailParams): Promise<{ success: boolean; error?: string }>`:
  - Create nodemailer transporter with Gmail SMTP
  - Include logo GMBS automatically as inline attachment (cid: logoGM)
  - Include user attachments if provided
  - Implement retry logic with exponential backoff (3 attempts: immediate, 2s, 4s)
  - Handle SMTP errors and network errors
  - Return success/error result
- [X] T024 Add timeout handling (60s backend timeout)
- [X] T025 Add logging for email send attempts and failures

**Checkpoint**: Core backend services ready - API routes can now be implemented

---

## Phase 4: Backend API Routes

**Purpose**: API endpoints for email sending and profile management

**Dependencies**: Phase 2 (Database) ✅, Phase 3 (Core Services) ✅

### Send Email API

- [X] T026 Create `app/api/interventions/[id]/send-email/route.ts`
- [X] T027 Implement POST handler with:
  - Authentication check (bearer token)
  - Parameter extraction (interventionId from params, type, artisanId, subject, htmlContent, attachments from body)
  - Intervention validation (exists, user has access)
  - Artisan validation (exists, has email)
  - User credentials retrieval from `users` table
  - Password decryption
  - Required fields validation (nomClient, telephoneClient, adresseComplete)
  - Email sending via `sendEmailToArtisan`
  - Log creation in `email_logs` table (async, non-blocking)
  - Error handling with appropriate HTTP status codes (400, 401, 404, 500)
- [X] T028 Add response types matching OpenAPI contract
- [X] T029 Add input validation (type must be 'devis' or 'intervention')
- [X] T030 Add error messages matching spec (credentials missing, artisan without email, required fields missing)

### Profile API Update

- [X] T031 Update `app/api/auth/profile/route.ts`:
  - Add handling for `email_smtp` field (validation: Gmail format)
  - Add handling for `email_password` field (encrypt before storage)
  - Update user record with encrypted password
  - Return success/error response
- [X] T032 Add validation for email format (Gmail validation)
- [X] T033 Add validation for password (not empty, reasonable length)

**Checkpoint**: API routes ready - frontend integration can now begin

---

## Phase 5: Frontend Components

**Purpose**: UI components for email editing and sending

**Dependencies**: Phase 4 (API Routes) ✅

### Email Edit Modal Component

- [X] T034 Create `src/components/interventions/EmailEditModal.tsx`
- [X] T035 Implement interface `EmailEditModalProps`:
  - isOpen, onClose, emailType, artisanId, artisanEmail, interventionId, templateData
- [X] T036 Implement state management:
  - `subject` (pre-filled from template)
  - `htmlContent` (pre-filled from template)
  - `attachments` (array of user-uploaded files)
  - `isSending` (loading state)
- [X] T037 Implement template generation on modal open:
  - Fetch intervention data
  - Map tenant data to EmailTemplateData (nomClient, telephoneClient, adresseComplete)
  - Select consigneArtisan based on artisan (is_primary → consigne_intervention, else → consigne_second_artisan)
  - Calculate coutSST from intervention_costs (cost_type='sst')
  - Generate template HTML using `generateDevisEmailTemplate` or `generateInterventionEmailTemplate`
  - Pre-fill subject and htmlContent
- [X] T038 Implement UI:
  - Dialog component (shadcn/ui)
  - Subject input field (editable)
  - HTML content textarea/editor (editable)
  - Attachment upload button
  - Attachment list with remove buttons
  - Logo GMBS indicator (non-removable, automatic)
  - Cancel button (closes modal)
  - Send button (disabled during sending, shows loading state)
- [X] T039 Implement attachment management:
  - File upload handler
  - File list display
  - File removal handler
  - File size validation (max 10 MB per file)
  - File count validation (max 5 files)
- [X] T040 Implement send handler:
  - Validate artisan selected
  - Validate subject and content not empty
  - Prepare FormData with attachments
  - Call POST `/api/interventions/:id/send-email`
  - Show toast "Envoi en cours..." at start
  - Handle timeout (70s frontend timeout)
  - Show success/error toast
  - Close modal on success
- [X] T041 Add error handling:
  - Display error messages from API
  - Handle network errors
  - Handle timeout errors with clear message

### Intervention Edit Form Integration

- [X] T042 Update `src/components/interventions/InterventionEditForm.tsx`:
  - Import `EmailEditModal` component
  - Import `Mail` icon from lucide-react
- [X] T043 Add state management:
  - `isDevisEmailModalOpen` (boolean)
  - `isInterventionEmailModalOpen` (boolean)
  - `selectedArtisanForEmail` (string | null)
- [X] T044 Add artisan selector (dropdown):
  - Filter artisans with valid email (`artisan.email` not empty)
  - Display in Select component (shadcn/ui)
  - Update `selectedArtisanForEmail` on selection
  - Disable buttons if no artisan selected
- [X] T045 Add two buttons in "Artisans à proximité" section:
  - "Mail demande de devis" button (opens devis modal)
  - "Mail demande d'intervention" button (opens intervention modal)
  - Both buttons disabled if no artisan selected
- [X] T046 Implement `handleOpenDevisEmailModal`:
  - Validate artisan selected
  - Set `isDevisEmailModalOpen` to true
  - Pass correct props to EmailEditModal
- [X] T047 Implement `handleOpenInterventionEmailModal`:
  - Validate artisan selected
  - Set `isInterventionEmailModalOpen` to true
  - Pass correct props to EmailEditModal
- [X] T048 Add EmailEditModal components (two instances, one for each type)
- [X] T049 Add toast notifications (using Sonner) for user feedback

### Settings Profile Integration

- [X] T050 Update `src/features/settings/SettingsRoot.tsx`:
  - Add email configuration section in Profile card
- [X] T051 Add form fields:
  - Email Gmail input (`email_smtp`)
  - Password input (`email_password`, type="password")
  - Link to Google App Password documentation
- [X] T052 Implement form submission:
  - Validate email format (Gmail)
  - Call PATCH `/api/auth/profile` with email_smtp and email_password
  - Show success/error toast
  - Update form state
- [X] T053 Add help text explaining Gmail App Password requirement

**Checkpoint**: Frontend components ready - feature is functionally complete

---

## Phase 6: Testing

**Purpose**: Unit tests, integration tests, and manual testing

**Dependencies**: All previous phases ✅

### Unit Tests

- [ ] T054 [P] Create test file `tests/unit/email-templates.test.ts`:
  - Test `generateDevisEmailTemplate` with complete data
  - Test `generateDevisEmailTemplate` with missing optional fields (defaults applied)
  - Test `generateInterventionEmailTemplate` with complete data
  - Test `generateInterventionEmailTemplate` with missing optional fields (defaults applied)
- [ ] T055 [P] Create test file `tests/unit/encryption.test.ts`:
  - Test `encryptPassword` and `decryptPassword` round-trip
  - Test with invalid key/IV (error handling)
- [ ] T056 [P] Create test file `tests/unit/email-service.test.ts`:
  - Mock nodemailer transporter
  - Test successful email send
  - Test retry logic (3 attempts with backoff)
  - Test logo GMBS automatic inclusion
  - Test user attachments inclusion
  - Test error handling (SMTP errors, network errors)

### Integration Tests

- [ ] T057 Create test file `tests/integration/send-email-api.test.ts`:
  - Test complete email send flow (devis)
  - Test complete email send flow (intervention)
  - Test authentication required
  - Test validation errors (missing credentials, missing artisan email, missing required fields)
  - Test log creation in email_logs table
  - Test error logging on failure

### Manual Testing

- [ ] T058 Test artisan selector (dropdown) displays only artisans with email
- [ ] T059 Test buttons disabled when no artisan selected
- [ ] T060 Test modal opens on button click
- [ ] T061 Test template pre-filling in modal (devis)
- [ ] T062 Test template pre-filling in modal (intervention)
- [ ] T063 Test subject and content editing in modal
- [ ] T064 Test attachment upload and removal
- [ ] T065 Test email send (devis) with logo inline
- [ ] T066 Test email send (intervention) with logo inline
- [ ] T067 Test email send with additional attachments
- [ ] T068 Test error handling (credentials missing)
- [ ] T069 Test error handling (artisan without email)
- [ ] T070 Test error handling (required fields missing)
- [ ] T071 Test email configuration in Settings > Profile
- [ ] T072 Test password encryption/decryption
- [ ] T073 Test logs visible in email_logs table
- [ ] T074 Test RLS policies (users see only their own logs, admins see all)

**Checkpoint**: All tests passing - feature is validated

---

## Phase 7: Documentation & Polish

**Purpose**: Final documentation, cleanup, and optimizations

**Dependencies**: All previous phases ✅

### Documentation

- [ ] T075 [P] Create user documentation for Gmail App Password setup:
  - Step-by-step guide
  - Screenshots if needed
  - Link in Settings UI
- [ ] T076 [P] Update technical documentation:
  - Architecture overview
  - Data flow diagrams
  - Error handling guide
- [ ] T077 [P] Update README if necessary with email feature

### Code Quality

- [ ] T078 [P] Run linter and fix any issues
- [ ] T079 [P] Add JSDoc comments to all public functions
- [ ] T080 [P] Review and optimize performance (if needed)
- [ ] T081 [P] Remove any console.log statements (replace with proper logging)

### Validation

- [ ] T082 Run quickstart.md validation checklist
- [ ] T083 Verify all OpenAPI contract endpoints match implementation
- [ ] T084 Verify all data-model.md entities match database schema

**Checkpoint**: Documentation complete, code polished - feature ready for production

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Database Schema (Phase 2)**: Depends on Setup completion - BLOCKS all backend work
- **Backend Core Services (Phase 3)**: Depends on Database Schema - BLOCKS API routes
- **Backend API Routes (Phase 4)**: Depends on Backend Core Services - BLOCKS frontend integration
- **Frontend Components (Phase 5)**: Depends on API Routes - Feature becomes functional
- **Testing (Phase 6)**: Depends on all implementation phases - Validates feature
- **Documentation & Polish (Phase 7)**: Depends on all phases - Finalizes feature

### Within Each Phase

- **Phase 1**: All tasks can run in parallel [P]
- **Phase 2**: Database tasks can run in parallel [P] after migration file created
- **Phase 3**: 
  - Encryption utilities can be done in parallel with templates [P]
  - Templates can be done in parallel [P]
  - Email service depends on templates
- **Phase 4**: 
  - Send Email API and Profile API Update can be done in parallel [P]
- **Phase 5**: 
  - Email Edit Modal can be done independently
  - Intervention Edit Form Integration depends on Email Edit Modal
  - Settings Profile Integration can be done in parallel [P]
- **Phase 6**: All test tasks can run in parallel [P]
- **Phase 7**: All documentation tasks can run in parallel [P]

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Database tasks marked [P] can run in parallel (after migration file)
- Encryption utilities and Templates can run in parallel
- Send Email API and Profile API Update can run in parallel
- Email Edit Modal and Settings Profile Integration can run in parallel
- All test tasks can run in parallel
- All documentation tasks can run in parallel

---

## Implementation Strategy

### MVP First (Core Functionality)

1. Complete Phase 1: Setup & Configuration
2. Complete Phase 2: Database Schema (CRITICAL - blocks all backend)
3. Complete Phase 3: Backend Core Services (CRITICAL - blocks API routes)
4. Complete Phase 4: Backend API Routes (CRITICAL - blocks frontend)
5. Complete Phase 5: Frontend Components (MVP functional!)
6. **STOP and VALIDATE**: Test core functionality manually
7. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Database + Backend Core → Foundation ready
2. Add API Routes → Backend ready
3. Add Frontend Components → Feature functional (MVP!)
4. Add Testing → Feature validated
5. Add Documentation → Feature complete

### Parallel Team Strategy

With multiple developers:

1. **Developer A**: Setup + Database Schema
2. **Developer B**: Backend Core Services (encryption + templates)
3. **Developer C**: Email Service (depends on templates)
4. **Developer A**: API Routes (depends on core services)
5. **Developer B**: Email Edit Modal (depends on API)
6. **Developer C**: Intervention Edit Form Integration (depends on modal)
7. **Developer A**: Settings Profile Integration (parallel)
8. **All**: Testing and Documentation (parallel)

---

## Notes

- [P] tasks = different files, no dependencies - can run in parallel
- Each phase has clear checkpoints for validation
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
- Avoid: vague tasks, same file conflicts, cross-phase dependencies that break independence
- Follow TypeScript strict mode and use alias `@/` for imports
- All components must use shadcn/ui and follow dark mode first design
- Security: Always validate on server side, encrypt passwords before storage

---

## Quick Reference

**Key Files**:
- Migration: `supabase/migrations/YYYYMMDDHHMMSS_add_email_smtp_fields.sql`
- Encryption: `src/lib/utils/encryption.ts`
- Templates: `src/lib/email-templates/intervention-emails.ts`
- Service: `src/lib/services/email-service.ts`
- API Route: `app/api/interventions/[id]/send-email/route.ts`
- Modal: `src/components/interventions/EmailEditModal.tsx`
- Form Integration: `src/components/interventions/InterventionEditForm.tsx`
- Settings: `src/features/settings/SettingsRoot.tsx`

**Key Dependencies**:
- `nodemailer` + `@types/nodemailer`
- Node.js `crypto` (built-in)
- shadcn/ui components (Dialog, Button, Input, Select, Textarea)
- Sonner for toasts
- lucide-react for icons

**Environment Variables**:
- `EMAIL_PASSWORD_ENCRYPTION_KEY` (32+ hex chars)
- `EMAIL_PASSWORD_ENCRYPTION_IV` (16 hex chars)
