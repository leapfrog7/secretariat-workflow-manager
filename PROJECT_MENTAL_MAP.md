# Secretariat Workflow Manager: Project Mental Map

Last updated: 12 August 2026

This is the repository navigation guide. It explains what each maintained source file does, which layer owns which responsibility, and how the files call or depend on one another. Generated folders (`dist`, `node_modules`), local secrets/logs, and binary OCR assets are intentionally excluded.

## 1. System at a glance

```text
GitHub Pages (React/Vite PWA)
  -> React routes, pages and components
  -> Dexie/IndexedDB local working copy
  -> Neon Auth for identity and sessions
  -> Neon Data API + PostgreSQL RLS for shared records
  -> Cloud Run protected API for Cloud AI and scheduled automation
  -> optional LM Studio on the user's device for Local AI

Google Cloud Scheduler
  -> /api/cron/daily on Cloud Run
  -> Neon reminders, deadline Web Push and scheduled Issue reactivation
```

The browser is local-first, but Neon is authoritative for identity, workspace membership, sharing and permissions. UI checks improve usability; PostgreSQL RLS is the security boundary. The portable handlers in `api/` run through `server/apiServer.js`; production enters through `server/cloudRun.js`.

## 2. Principal dependency flows

### Application startup

```text
index.html
  -> src/main.jsx
  -> AuthContext / ConfiguredAuthProvider
  -> AccessGate
  -> AppRoutes
  -> AppShell
  -> lazy page
```

`ConfiguredAuthProvider` validates the Neon session/profile/membership, scopes the local cache, configures sync runtimes, and reconciles Neon into Dexie. `AppShell` supplies navigation, sync status, conflicts, notifications and PWA installation around the active route.

### Normal Issue write

```text
Page/component
  -> entity repository in src/db
  -> normalizer/validator in src/utils
  -> Dexie transaction
  -> sync mutation/tombstone
  -> cloud API/sync module
  -> Neon Data API RPC/table
  -> PostgreSQL RLS + revision check
```

### Casework note generation

```text
CaseworkPage
  -> CaseworkModule
  -> NotingPanel
  -> optional documentTextExtraction or PdfContextDialog
       -> pdfExtractionService -> pdfTextToMarkdown
       -> pdfOcrService (Tesseract) for scanned pages
  -> noteAI provider-independent contract
  -> draftAIProviders
       -> lmStudioClient OR cloudAIClient
  -> editable NoteEditor preview
  -> noteRepository -> Dexie + cloudIssueItemSync
```

### Drafting

```text
NotingPanel or CaseworkModule
  -> DraftingWorkspace
  -> draftAIOrchestrator + draftAIPrompts
  -> provider transport
  -> normalized body blocks
  -> templateRegistry + draftDocument
  -> DraftDocumentEditor
  -> draftRepository / Paragraph Bank
  -> draftDocxRenderer for export
```

### Running summary AI

```text
RunningSummaryPanel
  -> optional shared PDF/OCR or Word/text extraction
  -> runningSummaryAI prompt/detail policy
  -> lmStudioClient or cloudAIClient
  -> editable Markdown
  -> summaryRepository -> cloudIssueItemSync
```

### Cloud AI request

```text
cloudAIClient
  -> Cloud Run /api/ai/generate
  -> api/ai/generate.js
  -> api/lib/cloudAI.js
  -> Neon authorization/quota RPCs
  -> selected provider
  -> metadata-only AI usage log
```

## 3. Root and architecture documents

| File | Responsibility and links |
| --- | --- |
| `AGENTS.md` | Binding engineering rules for access, RLS, sync, Casework, Noting, Drafting and delivery phases. Read before architectural work. |
| `README.md` | Installation, configuration, operation and user-facing repository overview. |
| `PROJECT_MENTAL_MAP.md` | This file: current code-navigation and dependency map. |
| `CASEWORK_ARCHITECTURE.md` | Constraints for top-level Casework and Issue-child Notes/Drafts; implemented by `CaseworkPage`, `CaseworkModule`, `NotingPanel` and `DraftingWorkspace`. |
| `DRAFTING_ARCHITECTURE.md` | Deterministic official-document and body-only AI rules; implemented under `src/features/drafting`. |
| `CLOUD_RUN_DEPLOYMENT.md` | Protected API migration/runbook for `server/`, `api/`, Scheduler and `VITE_API_BASE_URL`. |
| `COLLABORATION_GUIDE.md` | Operational guide to workspaces, divisions, sharing and effective access. |
| `REPORTING_MODULE.md` | Reporting behavior and export/AI refinement design. |
| `package.json` | Node 22 scripts and dependency declaration. `build`, `test`, database, auth, release and push utilities originate here. |
| `package-lock.json` | Reproducible npm dependency graph used by CI. |
| `index.html` | Vite HTML entry, PWA metadata and root mounting element for `main.jsx`. |
| `vite.config.js` | React/Tailwind build, GitHub Pages base path, LM Studio proxy, PDF.js optimization exclusion, and copying/serving OCR/PDF WASM assets. |
| `playwright.config.js` | Mobile browser-test configuration, phone viewport projects, failure artifacts and the local Vite test server. |
| `vercel.json` | Legacy/rollback Vercel configuration and cron declaration; protected production API authority is now Cloud Run. |
| `.env.example` | Documents browser-visible `VITE_` values and server-only secrets. |
| `.nvmrc` | Local Node major selection. |
| `.gcloudignore` | Excludes unnecessary/sensitive files from Cloud Run source uploads. |
| `.gitignore`, `.vercelignore` | Repository and legacy deployment exclusions. |

## 4. Browser entry, routes and shell

| File | Responsibility and links |
| --- | --- |
| `src/main.jsx` | Mounts React providers and routes; applies appearance settings; registers the service worker only in production and clears stale development workers/caches. |
| `src/constants/issueConstants.js` | Central product vocabulary and defaults: statuses, priorities, communication types, database version, settings, routes and AI preferences. Domain/UI files import from here instead of redefining values. |
| `src/routes/AppRoutes.jsx` | Hash-router route table. Wraps the app with `AccessGate`/`AppShell`, protects edit/admin routes, and lazy-loads pages through `routePreload`. |
| `src/routes/routePreload.js` | Single import map for lazy routing and predictive navigation preload. Used by routes and navigation feedback. |
| `src/layouts/AppShell.jsx` | Persistent header/sidebar/mobile-nav layout. Hosts sync, conflicts, notifications, PWA install and route progress around `<Outlet>`. |
| `src/index.css` | Tailwind import and global design behavior: responsive shell switching, mobile density, text-size preferences, safe areas, touch targets, focus, motion reduction, surfaces and Markdown rendering. |
| `src/hooks/useDirtyStateReporter.js` | Stable dirty-state reporting and unmount cleanup. Prevents changing callback identity from creating navigation/loading loops in Casework children. |

## 5. Pages

| File | Responsibility and main dependencies |
| --- | --- |
| `src/pages/IssueRegisterPage.jsx` | Primary Issues register: search/filter/view modes, cloud-paged Casework-scale search fallback, archive/restore/delete, table/card representations. Uses Issue/officer/communication repositories and Issue components. |
| `src/pages/IssueFormPage.jsx` | Loads and saves Issue create/edit forms. Delegates fields to `IssueForm`, persistence to `issueRepository`, and access defaults to collaboration helpers. |
| `src/pages/IssueWorkspacePage.jsx` | One Issue's details and child-resource workspace. Loads lightweight counts first and deferred tabs on demand; connects milestones, summaries, communications, references, access, Notes and Casework deep links. |
| `src/pages/CaseworkPage.jsx` | Top-level Casework surface and `/casework/:issueId` deep link. Loads authorized Issue context and renders the shared `CaseworkModule`; also provides Recent/Awaiting discovery. |
| `src/pages/ReportsPage.jsx` | Report selection, period controls, preview, CSV/DOCX export and optional Cloud/Local AI refinement. Uses report utilities and `ReportAIRefinement`. |
| `src/pages/ReferencesPage.jsx` | Workspace Reference Library: search, metadata, selective PDF/OCR or document-text retention, reusable extracts and archive controls. |
| `src/pages/AdminPage.jsx` | Platform/workspace administration: approvals, workspace assignment/provisioning, directory, divisions, policy and Cloud AI usage. Calls auth, workspace, access and AI admin APIs. |
| `src/pages/SettingsPage.jsx` | Personal/workspace settings, officer directory, office profile, appearance, Local/Cloud AI, reminders, push consent and backup/restore. Uses settings sync, repositories and notification APIs. |
| `src/pages/DashboardPage.jsx` | Legacy/auxiliary operational dashboard summaries. Not currently a primary route. |
| `src/pages/ReviewPage.jsx` | Legacy action-review surface retained in source; `/review` currently redirects to Issues. |
| `src/pages/HelpPage.jsx` | In-app workflow and safety guidance. Should be updated when visible behavior changes. |
| `src/pages/NotFoundPage.jsx` | Unknown-route recovery page. |

## 6. Layout, common and authentication components

### Layout and navigation

| File | Responsibility |
| --- | --- |
| `src/components/layout/Sidebar.jsx` | Collapsible desktop/landscape navigation; persists collapsed preference and shows route-opening feedback. |
| `src/components/layout/MobileNavigation.jsx` | Safe-area bottom navigation, distinct Create action and More sheet/menu. Reads auth permissions and navigation feedback. |
| `src/components/common/NavigationFeedback.jsx` | Provider/hooks for immediate route progress and pending destination state. |
| `src/components/common/UnsavedChangesGuard.jsx` | Blocks accidental internal/browser navigation when an editor reports unsaved work. |

### Shared UI primitives

| File | Responsibility |
| --- | --- |
| `AdaptiveSelect.jsx` | Native select for short lists and searchable datalist for longer lists. |
| `ModalFrame.jsx` | Accessible modal/mobile-sheet frame: focus trap, Escape/backdrop closing, scroll lock, safe areas and focus restoration. |
| `ConfirmDialog.jsx` | Standard confirmation UI built on `ModalFrame`. |
| `PageHeader.jsx` | Responsive page title, description and action layout using global density tokens. |
| `DisclosureSection.jsx` | Reusable progressive-disclosure section. |
| `SearchInput.jsx` | Standard search field presentation. |
| `EmptyState.jsx`, `ErrorState.jsx`, `LoadingState.jsx` | Consistent empty, failure and loading states. |
| `AppErrorBoundary.jsx`, `RouteErrorPage.jsx` | Global component and router error recovery. |
| `ToastProvider.jsx` | Global transient feedback API and safe mobile positioning. |
| `StatusBadge.jsx`, `PriorityBadge.jsx`, `DeadlineIndicator.jsx` | Shared status/priority/deadline visual semantics. |
| `WelcomeBanner.jsx` | Dismissible onboarding/welcome guidance. |

### Authentication gates

| File | Responsibility |
| --- | --- |
| `src/components/auth/AccessGate.jsx` | Converts auth state into sign-in, pending approval, no-workspace, error or application UI. Includes password visibility/reset entry points. |
| `RequireAdmin.jsx` | Route/UI guard for platform or workspace administration. PostgreSQL still enforces data access. |
| `RequireEditor.jsx` | Blocks mutating routes for workspace viewers. |

## 7. Issue, action and record components

| File | Responsibility and links |
| --- | --- |
| `src/components/issues/IssueForm.jsx` | Issue fields and validation display; uses constants, `issueUtils`, officer/division choices. |
| `IssueTable.jsx` | Desktop register rows and Issue actions. |
| `IssueCard.jsx` | Mobile register representation. |
| `FilterBar.jsx` | Register filters, including division/access filters. |
| `MilestoneStack.jsx` | Current-position history and position correction; backed by `milestoneRepository` and position utilities. |
| `QuickPositionDialog.jsx` | Compact position update workflow. |
| `RunningSummaryPanel.jsx` | Versioned Markdown summaries, Brief/Standard/Detailed AI, temporary PDF/OCR/Word/text sources, Local/Cloud generation and undo. |
| `CommunicationTab.jsx` | Communication list/edit UI, source metadata and dirty reporting. Uses `communicationRepository`. |
| `ReferenceTab.jsx` | Issue-facing library picker; attaches shared references and stores Issue-specific relevance and selected AI extracts. |
| `SourceSearchMatch.jsx` | Highlights source-search results in Issue/Casework lists. |
| `src/components/actions/ActionForm.jsx` | Legacy/auxiliary action assignment form. |
| `ActionIndicators.jsx` | Compact action-state indicators. |
| `ActionList.jsx` | Action table/list rendering. |
| `src/components/tasks/TaskWorkflowPanel.jsx` | Legacy task workflow controls. |
| `src/components/records/RecordForm.jsx` | Legacy record form. |
| `RecordList.jsx` | Legacy record list. |
| `ChronologyList.jsx` | Chronology event rendering. |
| `src/components/officers/OfficerForm.jsx` | Officer directory form used from Settings/admin flows. |

## 8. Casework, Noting and source documents

| File | Responsibility and links |
| --- | --- |
| `src/features/casework/CaseworkModule.jsx` | Shared Issue-child work surface switching between Examine and Note and Prepare Communication. Used by top-level Casework; reports dirty state upward. |
| `CaseworkIssuePicker.jsx` | Search/pick an accessible Issue for Casework. |
| `caseworkSearch.js` | Bounded local search and decision logic for when large cloud workspaces use server search. |
| `caseworkApi.js` | Access-checked cloud Casework search and content-free operational telemetry calls. |
| `caseworkActivity.js` | Derives Recent/Awaiting Casework entries from Issues, Notes and Drafts. |
| `caseworkActivityRepository.js` | Loads the data required by `caseworkActivity`. |
| `src/features/noting/NotingPanel.jsx` | Note list/editor orchestration, source-first workflow, Add Source sheet, paste-text review, AI assistance, selection rewrite, revisions and Drafting handoff. |
| `NoteEditor.jsx` | Lazy rich-text editor for a Note; exposes normalized content and selection positions. |
| `noteUtils.js` | Note normalization, validation, rich/plain projections and revision-safe data shape. |
| `noteAI.js` | Provider-independent Government noting contracts, complexity/length/purpose/structure guidance, examination maps, normalization and selection rewrite. |
| `document/documentTextExtraction.js` | In-browser `.docx`, `.txt` and `.md` extraction with size/type checks; does not store the original file. |
| `pdf/PdfContextDialog.jsx` | Shared PDF review sheet: page selection, editable extraction, OCR selection/language, cleanup metrics and attach callback. Used by Noting and Running Summary. |
| `pdf/pdfExtractionService.js` | Lazy-loads PDF.js, reads pages and layout items, detects OCR candidates and invokes reconstruction. |
| `pdf/pdfTextToMarkdown.js` | Reconstructs lines/paragraphs/headings/tables, removes repeated headers/footers and composes selected pages. |
| `pdf/pdfOcrService.js` | Renders selected PDF pages, runs English/Hindi Tesseract locally, sanitizes OCR noise and creates readable Markdown. |
| `pdf/pdfAssetUtils.js` | Resolves PDF decoder/WASM URLs under root or GitHub Pages base paths. |

## 9. Drafting subsystem

| File | Responsibility and links |
| --- | --- |
| `src/features/drafting/DraftingWorkspace.jsx` | Full drafting UI: deterministic details, AI preparation dialog, context selection, saved versions, paragraph bank, editor and DOCX export. |
| `ai/draftAIOrchestrator.js` | Sole provider-independent drafting operation coordinator. Only substantive body blocks may be generated/replaced. |
| `ai/draftAIPrompts.js` | Official drafting prompt contracts, content-length and paragraph-style guidance, context limits and output allowance. |
| `ai/draftAIProviders.js` | Selects Local or Cloud transport without duplicating drafting policy. |
| `domain/draftDocument.js` | Structured draft schema, deterministic document assembly, protected regions, validation and legacy compatibility. |
| `domain/draftRichText.js` | Normalized rich-text body model and safe plain-text projection; rejects arbitrary HTML. |
| `domain/draftWorkingCopy.js` | Tracks content/setup dirty state and safe behavior when opening saved/immutable versions. |
| `editor/DraftDocumentEditor.jsx` | Lazy rich body editor, selection mapping, protected structure presentation, formatting and readiness review. |
| `templates/templateRegistry.js` | Versioned deterministic official communication templates and required structural markers. |
| `renderers/draftDocxRenderer.js` | Converts structured/legacy drafts into formatted Word documents. |
| `paragraphBank/ParagraphBankPanel.jsx` | Search, insert and manage personal/shared reusable wording. |
| `paragraphBank/paragraphBankUtils.js` | Entry normalization, validation, filtering, placeholders and access rules. |
| `paragraphBank/paragraphBankRepository.js` | Local Dexie CRUD/outbox behavior for paragraph entries. |
| `paragraphBank/paragraphBankApi.js` | Neon Data API calls for paragraph resources. |
| `paragraphBank/paragraphBankSync.js` | Reconciles scoped personal/shared paragraph entries and revisions. |
| `src/features/cloud/referenceLibraryApi.js`, `referenceLibrarySync.js` | RLS-backed shared-reference and Issue-link synchronization with revision-checked saves. |

## 10. Local repositories and IndexedDB

| File | Responsibility and links |
| --- | --- |
| `src/db/database.js` | Dexie database, all browser schema upgrades and settings merge/save behavior. All repositories depend on it. |
| `issueRepository.js` | Issue lifecycle, position changes, scheduling, archive/restore/delete, cache purge and cloud queueing. Central domain repository. |
| `milestoneRepository.js` | Position/stage history CRUD and cloud item queueing. |
| `summaryRepository.js` | Append/list/delete running-summary versions and cloud synchronization. |
| `communicationRepository.js` | Communication CRUD, normalization, tombstones and sync. |
| `referenceRepository.js` | Workspace Reference Library and Issue-link CRUD; supplies a compatibility Issue-reference view to Noting and Drafting. |
| `noteRepository.js` | Note CRUD; editing first stores an immutable revision snapshot, then syncs the current Note. |
| `draftRepository.js` | Mutable working drafts, immutable snapshots, five-record retention and sync behavior. |
| `officerRepository.js` | Officer directory CRUD and cloud sync. |
| `officerDeduplication.js` | Identifies equivalent officer identities during import/sync. |
| `backupService.js` | Export/import of local data; import records explicit sync mutations for cloud restoration. |
| `syncMutationRepository.js` | Durable local outbox describing pending upserts/deletes. |
| `syncConflictRepository.js` | Stores genuine local-versus-cloud conflicts for user review. |
| `actionRepository.js`, `recordRepository.js`, `chronologyRepository.js` | Retained legacy/auxiliary workflow stores and chronology linkage. |
| `seedData.js` | Optional demo/local initial data. |

## 11. Authentication, access and cloud synchronization

### Authentication and workspace context

| File | Responsibility |
| --- | --- |
| `src/features/auth/authConfig.js` | Reads and validates Neon frontend configuration. |
| `cloudClient.js` | Singleton Neon Auth/Data API client. |
| `AuthContext.jsx` | Stable auth/workspace/role context and local-versus-cloud contract. |
| `ConfiguredAuthProvider.jsx` | Cloud startup, account/profile/membership checks, cache scope, sync configuration and full reconciliation. |
| `accountApi.js` | Account approval, password/reset-related and platform directory operations exposed by Neon Auth/Data API. |
| `src/utils/accessUtils.js` | Derives UI edit/admin capability from platform/workspace/division/effective access. |
| `src/features/collaboration/accessApi.js` | Division membership, Issue ownership/visibility/grants and access-reason APIs. |
| `src/components/collaboration/DivisionAdminPanel.jsx` | Division creation/membership/readiness/enforcement UI. |
| `IssueAccessPanel.jsx` | Per-Issue Share and access UI. PostgreSQL functions remain authoritative. |

### Core cloud files

| File | Responsibility |
| --- | --- |
| `cloudIssueApi.js` | Data API/RPC transport for paged Issues and revision-aware writes/deletes. |
| `cloudIssueSync.js` | Reconciles core Issues, pending mutations, tombstones, conflicts and authoritative visible IDs. |
| `cloudIssueItemApi.js` | Generic transport for communication/reference/milestone/summary/note/draft child rows. |
| `cloudIssueItemSync.js` | Generic child-record reconciler; `ITEM_CONFIG` maps types to Dexie tables and normalizers. |
| `cloudIssueItemRecovery.js` | Interprets missing-row/revision RPC failures safely without treating permission errors as absence. |
| `cloudOfficerApi.js`, `cloudOfficerSync.js` | Officer directory transport and reconciliation. |
| `cloudSettingsApi.js`, `cloudSettingsSync.js` | Revision-aware personal/workspace settings transport and ownership split. |
| `cloudPagination.js` | Counted page reader; refuses partial or uncounted collections before cache purging. |
| `cloudPayloadUtils.js` | Material comparison that ignores sync metadata/timestamp noise. |
| `cloudRevisionConflict.js` | Normalizes revision conflict errors and comparison metadata. |
| `syncConflictResolution.js` | Applies Keep cloud version or retries Use my change against the newest revision. |
| `visibleIssueUtils.js` | Computes safe local purging from authoritative visible Issue IDs. |
| `localWorkspaceScope.js` | Resets/scopes IndexedDB when user/workspace identity changes. |
| `workspaceApi.js` | Workspace directory, provisioning/configuration and membership transport. |
| `workspaceScopeUtils.js` | Workspace/user scope keys and validation helpers. |
| `src/components/cloud/ConnectivityBanner.jsx` | Offline/restored connection feedback. |
| `SyncStatusPanel.jsx` | Header synchronization state and manual-sync dialog. |
| `SyncConflictCenter.jsx` | Global conflict review UI. |

## 12. AI services and shared contracts

| File | Responsibility and links |
| --- | --- |
| `src/services/lmStudioClient.js` | Local model discovery/test, prompt-size enforcement, running-summary generation and provider transport for drafting/report operations. |
| `src/services/cloudAIClient.js` | Authenticated Cloud Run client for status/generation; sends provider-independent instructions and context. |
| `src/utils/aiContextUtils.js` | Creates bounded factual Issue context used by Noting/Drafting. |
| `src/utils/cloudAIUrl.js` | Resolves the configured protected API origin, migrates the retired Vercel origin to Cloud Run and preserves local development origins. |
| `src/utils/runningSummaryAI.js` | Brief/Standard/Detailed summary prompts and output-token budgets shared by Local and Cloud clients. |
| `src/utils/governmentDraftUtils.js` | Legacy compatibility and common official communication vocabulary/formatting helpers. |
| `src/utils/reportAIUtils.js` | Report refinement prompt, input limits, normalization and factual warnings. |
| `src/features/ai/cloudAIAdminApi.js` | Admin reads/updates AI availability, quotas and usage summaries. |
| `src/components/ai/AIModeControl.jsx` | Local/Cloud mode selector. |
| `GeminiTaskLevelControl.jsx` | Advanced Gemini reasoning/task-level control. |
| `shared/cloudAIModels.js` | Server/client-neutral provider model routing and supported-model metadata. |
| `shared/releaseContract.js` | Shared expected protected-API health/release contract used by verification. |

## 13. Notifications and PWA

| File | Responsibility and links |
| --- | --- |
| `src/features/notifications/cloudNotificationApi.js` | Reads and marks durable Neon notification inbox entries. |
| `pushNotificationApi.js` | Browser permission/subscription lifecycle and access-checked server registration. |
| `src/components/notifications/NotificationCenter.jsx` | Header inbox/bell UI. |
| `PushNotificationSetting.jsx` | Per-device Web Push consent and subscription management. |
| `src/components/pwa/InstallAppButton.jsx` | Handles `beforeinstallprompt` and platform-specific install guidance. |
| `public/manifest.webmanifest` | PWA identity, icons, start URL and standalone mode. |
| `public/sw.js` | App-shell caching, navigation/cache behavior, deadline push display and notification click routing. |
| `public/favicon.svg` | Application icon source. |

## 14. Reporting and general utilities

| File | Responsibility |
| --- | --- |
| `src/components/reports/ReportAIRefinement.jsx` | AI refinement consent, preview and result controls. |
| `src/utils/reportUtils.js` | Builds Current, Attention, Completed and activity report datasets. |
| `reportExportUtils.js` | DOCX generation for reports. |
| `reportCsvUtils.js` | CSV export. |
| `dateUtils.js` | Display, comparison and India-time helpers. |
| `scheduleUtils.js` | Recurrence and scheduled-return calculations. |
| `positionUpdateUtils.js` | Position correction and milestone mapping. |
| `issueWorkspaceLoading.js` | Maps tabs to deferred data sections and lightweight counts. |
| `appearanceUtils.js` | Applies Small/Normal/Large preference to the document root/local storage. |
| `settingsUtils.js` | Detects personal versus workspace settings changes. |
| `tabKeyboardUtils.js` | Arrow/Home/End keyboard behavior for tab lists. |
| `officerIdentity.js`, `officerUtils.js` | Stable officer comparison, normalization and validation. |
| `issueUtils.js`, `communicationUtils.js`, `referenceUtils.js`, `milestoneUtils.js`, `summaryUtils.js`, `draftUtils.js` | Entity normalization/validation and backward-compatible defaults. |
| `actionUtils.js`, `recordUtils.js`, `chronologyUtils.js` | Legacy action/record/chronology domain helpers. |
| `draftExportUtils.js` | Export-facing draft compatibility helpers. |
| `src/components/editor/RichTextFormatting.js` | Shared Tiptap formatting constants/helpers used by Note and Draft rich-text editors. |

## 15. Protected API and Cloud Run

| File | Responsibility and call chain |
| --- | --- |
| `server/cloudRun.js` | Production process entry; starts the portable HTTP server on Cloud Run's host/port. |
| `server/apiServer.js` | Routes health, readiness, AI and cron paths to the existing `api/` handlers; adapts Node HTTP request/response and bounds JSON bodies. |
| `api/readiness.js` | Deep readiness check, including required server configuration/database reachability. |
| `api/ai/status.js` | Authenticated provider/status endpoint. |
| `api/ai/generate.js` | Authenticated generation endpoint; validates operation/context and delegates authorization/quota/provider work. |
| `api/cron/daily.js` | `CRON_SECRET`-protected daily automation endpoint used by Cloud Scheduler. |
| `api/lib/http.js` | Shared method, CORS, authentication/error response utilities. |
| `api/lib/cloudAI.js` | Neon access checks, operation authorization, quota reservation, provider calls and metadata-only completion/failure logging. |
| `api/lib/dailyAutomation.js` | Scheduled Issue reactivation, reminder/inbox creation, Web Push dispatch, deduplication and run audit. |

## 16. Database migrations

Migrations are append-only and applied by filename order. Browser UI must not assume a feature exists before its required migration is deployed.

| Migration | Purpose |
| --- | --- |
| `001_identity_and_access.sql` | Profiles, workspaces, memberships and initial RLS helpers. |
| `002_workspaces_and_cloud_issues.sql` | Cloud Issues and workspace policies. |
| `003_require_active_profile_for_workspace.sql` | Active-profile enforcement. |
| `004_workspace_editor_permissions.sql` | Editor/viewer workspace semantics. |
| `005_cloud_officer_directory.sql` | Shared officers. |
| `006_complete_workspace_sync.sql` | Child-item/settings synchronization foundation. |
| `007_background_reminders.sql` | Notifications and automation runs. |
| `008_cloud_ai.sql` | AI providers/policy/usage/quota functions. |
| `009_division_access_foundation.sql` | Divisions, memberships and grants behind a feature flag. |
| `010_shared_issue_access.sql` | Effective Issue access and inherited child RLS. |
| `011_reload_data_api_schema.sql` | Data API schema reload support. |
| `012_optimistic_concurrency.sql` | Monotonic revisions and compare-and-swap RPCs. |
| `013_security_and_sync_hardening.sql` | Active membership, child ownership and sync hardening. |
| `014_preserve_last_administrators.sql` | Prevents removal of last critical administrators. |
| `015_require_issue_division_when_enforced.sql` | Owning division requirement under enforcement. |
| `016_separate_issue_access_management.sql` | Restricts policy/grant management separately from content editing. |
| `017_cloud_ai_report_operation.sql` | Report refinement AI operation. |
| `018_report_permission_hardening.sql` | Access-checks report AI across selected Issues. |
| `019_paragraph_bank.sql` | Personal/shared Paragraph Bank storage and policies. |
| `020_draft_snapshot_retention.sql` | Cloud draft snapshot retention. |
| `021_issue_notes.sql` | Notes and immutable revision history. |
| `022_workspace_provisioning_and_isolation.sql` | Independent workspace provisioning/isolation. |
| `023_administration_workspace_directory.sql` | Platform admin metadata directory without Issue-content bypass. |
| `024_admin_approve_and_assign_workspace.sql` | Atomic approval and primary workspace assignment. |
| `025_casework_scale_and_telemetry.sql` | Access-checked paged Casework search and content-free failure events. |
| `026_workspace_configuration_hardening.sql` | Restricts officer/profile settings and adds revision checks. |
| `027_web_push_deadline_notifications.sql` | Scoped push subscriptions and deadline notification delivery. |
| `028_workspace_reference_library.sql` | Reusable workspace references, Issue links, RLS, revision saves and legacy-reference migration. |

## 17. Operational scripts and CI

| File | Responsibility |
| --- | --- |
| `scripts/local-dev.js` | Starts local frontend/API processes using the shared adapter. |
| `scripts/local-api-server.js` | Local wrapper around `server/apiServer.js`. |
| `scripts/migrate.js` | Applies unapplied `db/migrations` using server-only `DATABASE_URL`. |
| `scripts/prepare-test-database.js` | Creates/resets the CI integration database. |
| `scripts/verify-database.js` | Verifies required migrations/schema/policies/functions. |
| `scripts/reload-data-api-schema.js` | Requests Neon Data API schema refresh. |
| `scripts/verify-release.js` | Checks deployed protected API health/readiness/release contract before Pages deployment. |
| `scripts/bootstrap-admin.js` | Initial platform administrator bootstrap. |
| `scripts/trust-auth-origin.js` | Adds deployed frontend origin to Neon Auth trusted origins. |
| `scripts/generate-vapid-keys.js` | Generates Web Push VAPID key pair; private key remains server-only. |
| `.github/workflows/ci.yml` | Pull-request database migration, verification, tests and production build. |
| `.github/workflows/deploy-pages.yml` | On `main`: migration checks, all tests, release verification, build and GitHub Pages deployment. |
| `.github/workflows/mobile-e2e.yml` | On pull requests and `main`: installs Chromium and verifies critical mobile Issue/Casework flows in Playwright. |

## 18. Tests: what each file protects

Most tests use Node's built-in runner. UI contract tests intentionally inspect source where a browser DOM is unnecessary; `tests/e2e` uses Playwright for real-browser mobile workflows.

| Test file | Protected behavior |
| --- | --- |
| `accessUtils.test.js` | Role/effective-access derivation and fail-closed cases. |
| `apiServer.test.js` | Portable routing, health, CORS, auth and malformed bodies. |
| `applicationResilienceContracts.test.js` | Error boundaries, shell accessibility and tab keyboard adoption. |
| `caseworkActivity.test.js` | Recent/Awaiting derivation. |
| `caseworkArchitecture.test.js` | Shared top-level Casework composition/deep links/alignment. |
| `caseworkNavigationResilience.test.js` | Stable dirty reporters and service-worker response cloning. |
| `caseworkSearch.test.js` | Local/paged cloud Casework search decisions. |
| `caseworkSourceFlow.test.js` | Source-first Noting, dialog responsiveness, PDF/OCR and Add Source flow. |
| `cloudAIModels.test.js`, `cloudAIUrl.test.js` | Provider routing/task level and API-origin resolution. |
| `cloudIssueItemRecovery.test.js` | Safe missing-row versus permission error interpretation. |
| `cloudPagination.test.js` | Counted complete pages and partial-response refusal. |
| `cloudPayloadUtils.test.js` | Material equality despite sync metadata/key order. |
| `documentTextExtraction.test.js` | Word/text/Markdown extraction and legacy `.doc` messaging. |
| `draftAIOrchestrator.test.js` | Provider-independent body-only drafting and prompt contract. |
| `draftDocument.test.js` | Templates, protected structure, normalization and validation. |
| `draftDocxRenderer.test.js` | Word structure, formatting, tables and indentation. |
| `draftVersioning.test.js`, `draftWorkingCopy.test.js` | Snapshot retention and mutable/immutable dirty behavior. |
| `integration/collaborationDatabase.test.js` | Real PostgreSQL RLS, revisions, retention and workspace isolation. |
| `issueUtils.test.js`, `issueWorkspaceLoading.test.js` | Issue helpers, previews and deferred section/count mapping. |
| `lmStudioClient.test.js` | Local model selection, errors and context limits. |
| `localWorkspaceScope.test.js` | User/workspace cache isolation. |
| `mobileUiContracts.test.js` | Safe areas, dialogs, navigation, density, PWA and mobile layout. |
| `e2e/mobile-casework.spec.js` | Real Chromium checks for phone navigation, Issue creation and viewport-safe Casework source/paste dialogs. |
| `noteAI.test.js`, `noteUtils.test.js` | Noting prompts/modes/selection rewrite and rich/revision data. |
| `officerUtils.test.js` | Officer identity and remapping. |
| `paragraphBank.test.js` | Scope, validation, placeholders, search and admin rights. |
| `pdfDevelopmentRuntime.test.js` | Vite PDF import stability and dev service-worker isolation. |
| `pdfOcrService.test.js` | OCR languages, sanitization, merging and page Markdown. |
| `pdfTextToMarkdown.test.js` | PDF layout reconstruction and OCR candidate detection. |
| `positionUpdateUtils.test.js` | Present-position/milestone correction. |
| `pushNotifications.test.js` | Subscription security, daily delivery and service-worker handling. |
| `reportAIUtils.test.js`, `reportUtils.test.js` | Report prompts, periods, datasets and Word/CSV exports. |
| `referenceLibrary.test.js` | Reference/link separation, retained-text limits, routing, OCR integration and RLS migration contracts. |
| `runningSummaryAI.test.js` | Summary complexity prompts and output budgets. |
| `runningSummarySourceDocument.test.js` | Running Summary source/OCR reuse and temporary material safeguards. |
| `settingsUtils.test.js` | Personal/workspace/device settings timestamp ownership. |
| `summaryUtils.test.js` | Legacy/current summary normalization and comparison. |
| `tabKeyboardUtils.test.js` | Accessible tab keyboard navigation. |
| `visibleIssueUtils.test.js` | Authoritative cache purge and pending-new Issue preservation. |

## 19. Where to change common behavior

### Add a field to an Issue

1. Normalize/default/validate in `issueUtils.js`.
2. Add UI in `IssueForm.jsx`.
3. Persist through `issueRepository.js`.
4. Add a Dexie index/version only if queried locally.
5. Add a migration if a first-class cloud column/constraint/RLS rule is needed.
6. Update register/workspace/report display and tests.

### Add an Issue child resource

1. Create normalizer and repository.
2. Add a Dexie store/version.
3. Add the type to `cloudIssueItemSync.ITEM_CONFIG` and API validation.
4. Extend PostgreSQL type constraints/RLS with a migration.
5. Add UI, authoritative purge, conflict and integration tests.

### Change Noting AI

Keep policy in `noteAI.js`, transport in `draftAIProviders`/service clients, editor conversion in `noteUtils`, and source extraction under `features/noting/document|pdf`. Do not assemble a separate prompt inside a component/provider.

### Change official Drafting

Use `draftAIPrompts`/`draftAIOrchestrator` for AI body behavior, `draftDocument`/`templateRegistry` for protected structure, `draftRichText` for persistence and `draftDocxRenderer` for export. Never let provider output own subject, recipient or signature.

### Change permissions

Update PostgreSQL functions/policies in a new migration first, then `accessApi` and UI explanations. Never treat frontend hiding/disabled controls as authorization.

### Add a notification

Add its database constraint/deduplication in a migration, creation/delivery in `dailyAutomation`, browser handling if push-specific, settings/notification UI, and tests.

## 20. Recommended reading order

1. `AGENTS.md`
2. `src/routes/AppRoutes.jsx`
3. `src/layouts/AppShell.jsx`
4. `src/features/auth/ConfiguredAuthProvider.jsx`
5. `src/db/database.js`
6. `src/db/issueRepository.js`
7. `src/features/cloud/cloudIssueSync.js`
8. `src/features/cloud/cloudIssueItemSync.js`
9. `src/pages/IssueWorkspacePage.jsx`
10. `src/pages/CaseworkPage.jsx`
11. `src/features/casework/CaseworkModule.jsx`
12. `src/features/noting/NotingPanel.jsx` and `noteAI.js`
13. `DRAFTING_ARCHITECTURE.md` then `src/features/drafting/`
14. `server/apiServer.js`, `api/ai/generate.js`, `api/lib/cloudAI.js`
15. migrations `010`, `012`, `013`, `021`, `025`, `026`, `027`

## 21. Architectural invariants

1. Pages coordinate; repositories own persistence and lifecycle rules.
2. Dexie is the local working copy; Neon is the shared authority.
3. RLS and access-checking database functions—not React—protect official data.
4. Child records inherit Issue access and cannot rely only on workspace membership.
5. Counted complete cloud reads are required before authoritative cache purging.
6. Revisions produce human-reviewable conflicts instead of silent overwrite.
7. Models generate substantive prose only; official structure and attribution remain deterministic.
8. Files/OCR/pasted sources remain temporary unless their reviewed result is explicitly saved as a Note, Draft or Summary.
9. Provider credentials and `DATABASE_URL` never enter `VITE_` variables or browser storage.
10. GitHub Pages hosts the PWA; Cloud Run hosts the protected API; Neon hosts identity/data; LM Studio is optional and local.
