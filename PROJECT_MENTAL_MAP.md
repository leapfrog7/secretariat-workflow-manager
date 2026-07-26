# Secretariat Workflow Manager: Project Mental Map

This document explains the small set of files and ideas needed to understand the application deeply. It intentionally omits routine presentational components and repetitive repository code.

## 1. The System in One Picture

```text
User browser
  |
  +-- React pages and components
  |     Issues register, Issue workspace, Settings, Help, Administration
  |
  +-- Dexie / IndexedDB
  |     Fast local working copy of Issues and related records
  |
  +-- Neon Auth
  |     Sign-in, account identity and session token
  |
  +-- Neon Data API
  |     Shared workspace records, protected by PostgreSQL RLS
  |
  +-- LM Studio on the same laptop
        Optional local draft generation

Vercel application and server functions
  |
  +-- Vite frontend
  |     Production application and hash-routed client
  |
  +-- Protected Cloud AI endpoints
  |     Provider availability, authorization, quota and generation
  |
  +-- Neon PostgreSQL
  |     Scheduled Issue reactivation and durable notifications
  |
  +-- Resend (optional)
        Reminder emails when server credentials are configured
```

The central architectural idea is:

> The browser works against IndexedDB first, then synchronizes that local working copy with Neon. Background work runs separately on Vercel and writes directly to Neon.

There is no long-running Express application server. Vercel hosts the static Vite
application plus small serverless functions for scheduled automation and Cloud AI.

## 2. Four Layers to Keep in Mind

| Layer | Responsibility | Important location |
| --- | --- | --- |
| Interface | Screens, tabs, forms and user actions | `src/pages`, `src/components` |
| Local domain | Validation, normalization and IndexedDB writes | `src/db`, `src/utils` |
| Cloud collaboration | Neon API calls and two-way reconciliation | `src/features/auth`, `src/features/cloud` |
| Background backend | Scheduler, notification creation and optional email | `api`, `vercel.json` |

Most features touch the first two layers. Shared or scheduled features also touch the third or fourth layer.

## 3. Application Entry and Navigation

### `src/main.jsx`

This is the browser entry point. Its provider order is conceptually important:

```jsx
<AuthProvider>
  <ToastProvider>
    <AppRoutes />
  </ToastProvider>
</AuthProvider>
```

Authentication and workspace state are therefore available to every route. Toast feedback is also globally available.

### `src/routes/AppRoutes.jsx`

This file is the best quick index of the application:

```jsx
const router = createHashRouter([
  {
    path: '/',
    element: <AccessGate><AppShell /></AccessGate>,
    children: [
      { path: 'issues', element: <IssueRegisterPage /> },
      { path: 'issues/new', element: <IssueFormPage mode="create" /> },
      { path: 'issues/:issueId', element: <IssueWorkspacePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: 'admin', element: <RequireAdmin><AdminPage /></RequireAdmin> },
    ],
  },
]);
```

Hash routing is used because the main frontend is hosted on GitHub Pages. A URL after `#` is handled entirely by React and does not require server-side route rewriting.

Routes are lazy-loaded. `src/routes/routePreload.js` owns the matching import
functions so navigation can preload the same chunks on hover, pointer-down or
touch without creating a second import map.

### `src/layouts/AppShell.jsx`

The shell owns the persistent desktop sidebar, mobile navigation and top header. The cloud sync control and notification inbox live here because they apply to the whole workspace.

The shell also installs `NavigationFeedbackProvider`. It captures internal link
transitions globally, starts the top progress indicator immediately, and lets
the desktop and mobile navigation show an `Opening` state. Once the route mounts,
`LoadingState` provides the destination's API/IndexedDB loading feedback.

## 4. The Main User Workflow

### `src/pages/IssueRegisterPage.jsx`

This is the operational home screen. It:

- loads Issues, officers and communications from IndexedDB;
- calculates dashboard totals;
- searches Issue and eReceipt metadata;
- separates Current, Scheduled and Archived views;
- paginates Archived results at 25, 50 or 100 rows on both desktop and mobile;
- provides direct archive, restore and permanent-delete row actions; and
- passes the resulting rows to `IssueTable` or `IssueCard`.

The important pattern is derived state:

```jsx
const filtered = useMemo(() => {
  return data.issues
    .filter(/* register view, status and search rules */)
    .sort(/* selected ordering */);
}, [data.issues, filters]);
```

Archived pagination currently limits rendered rows, not data retrieval. The
register still loads every Issue and communication into memory before filtering.

The register does not own persistence. It asks repository functions such as `getAllIssues`, `restoreIssue` and `bringBackIssue` to change data.

### `src/pages/IssueFormPage.jsx` and `src/components/issues/IssueForm.jsx`

`IssueFormPage` coordinates create/edit loading and saving. `IssueForm` owns the actual fields and validation display.

New Issue defaults and allowed values come from `src/constants/issueConstants.js`. Domain normalization and final validation happen in `src/utils/issueUtils.js`, not only in the form.

When division-based access is enforced, Owning division is required by both the
form and PostgreSQL migration `015`. A stale client or direct API call therefore
cannot create an unassigned cloud Issue.

### `src/pages/IssueWorkspacePage.jsx`

This is the complete workspace for one Issue. Its six tabs define the current product model:

```js
const tabs = [
  'Current Position',
  'Running Summary',
  'Record of Communication',
  'References',
  'AI Context',
  'Share & Access',
];
```

The page loads the Issue graph in parallel: Issue, officers, milestones, summaries, communications and references. Each tab delegates to a focused component.

| Tab | Main component | Stored information |
| --- | --- | --- |
| Current Position | `MilestoneStack` | present stage, schedule and preserved stage history |
| Running Summary | `RunningSummaryPanel` | versioned narrative summary |
| Record of Communication | `CommunicationTab` | chronology, eReceipt and source metadata |
| References | `ReferenceTab` | rules, O.M.s, directions and citations |
| AI Context | `AIContextPreview` | selected context and generated drafts |
| Share & Access | `IssueAccessPanel` | owning division, visibility and explicit grants |

On mobile these tabs render as a compact multi-row chip grid rather than one
long horizontal scroller.

## 5. Domain Rules and Local Persistence

### `src/constants/issueConstants.js`

Read this before changing terminology. It contains:

- Issue stages and priorities;
- subject and communication types;
- default categories;
- office, Local AI and reminder defaults;
- database name and version; and
- application routes.

This is the vocabulary of the product.

### `src/db/database.js`

This file defines the Dexie database and all IndexedDB schema versions. The current stores are conceptually:

```text
issues
officers
communications
references
issueMilestones
issueSummaries
drafts
settings
syncTombstones

legacy/supporting stores: actions, records, chronology
```

`getSettings()` merges saved settings over defaults. `saveSettings()` also maintains separate timestamps for shared workspace settings and personal user settings.

```js
const workspaceChanged = /* categories or office profile changed */;
const userChanged = /* Local AI or reminder settings changed */;
```

This distinction is important because those two setting groups have different cloud ownership.

### `src/db/issueRepository.js`

This is the most important domain repository. Start here when changing Issue lifecycle behavior.

Key operations are:

```js
createIssue(input)
updateIssuePosition(id, input)
reactivateScheduledIssues(options)
bringBackIssue(id)
archiveIssue(id)
restoreIssue(id)
permanentlyDeleteIssue(id)
```

The repository does more than save the Issue. For example, a position update can also add a milestone, schedule a completed recurring Issue, write a chronology event and queue cloud synchronization.

The general write flow is:

```text
Normalize input
  -> validate domain rules
  -> update IndexedDB transaction
  -> create related milestone/history
  -> queue Neon upsert
```

### Normalizers in `src/utils`

Every major entity has a normalizer, for example:

- `issueUtils.js`
- `communicationUtils.js`
- `referenceUtils.js`
- `milestoneUtils.js`
- `summaryUtils.js`
- `draftUtils.js`

A normalizer gives old, imported and cloud data a stable shape. Add defaults there when adding a field, especially when existing records will not contain it.

## 6. Authentication and Workspace Access

### `src/features/auth/cloudClient.js`

Creates one Neon client combining Neon Auth and the Neon Data API. Auth tokens are attached automatically to Data API requests.

### `src/features/auth/AuthContext.jsx`

Chooses between:

- cloud mode when valid Neon URLs exist; and
- local mode when cloud configuration is absent.

Local mode keeps the application usable without accounts, but shared synchronization and server notifications require cloud mode.

### `src/features/auth/ConfiguredAuthProvider.jsx`

This file orchestrates startup. Its sequence is the best mental model for opening the application:

```js
async function synchronizeWorkspace(configuration) {
  const officers = await syncWorkspaceOfficers(configuration);
  const issues = await syncWorkspaceIssues(configuration);
  const items = await syncWorkspaceIssueItems(configuration);
  const settings = await syncWorkspaceSettings(configuration);
  window.dispatchEvent(new CustomEvent('swm:workspace-synced'));
}
```

Before synchronization, it checks:

1. Is there a valid Neon session?
2. Is the application profile active?
3. Does the user have an active workspace membership?
4. Is the membership editable or viewer-only?

### `src/components/auth/AccessGate.jsx`

Turns authentication state into the screens the user sees: sign-in, approval pending, no workspace access, error or the actual application.

### `src/pages/AdminPage.jsx`

Provides account approval, workspace membership, division administration and
Cloud AI policy controls. Its API calls are in `src/features/auth/accountApi.js`,
`src/features/cloud/workspaceApi.js`, `src/features/collaboration/accessApi.js`
and `src/features/ai`.

Stored role values and current display labels are:

| Scope | Stored value | Display meaning |
| --- | --- | --- |
| Platform | `platform_admin` | System administrator |
| Workspace | `viewer` | View only for workspace-visible Issues |
| Workspace | `officer` | Can edit workspace-visible Issues |
| Workspace | `workspace_admin` | Workspace manager |
| Division | `viewer` | Can view owning-division Issues |
| Division | `editor` | Can edit owning-division Issues |
| Division | `division_admin` | Division manager |

The word “officer” remains a domain identity in the officer directory and Issue
assignment fields. In permission selectors it is displayed as “Can edit”.

Workspace and division permissions are scoped rather than a single hierarchy.
Once division access is enforced, a workspace editor with a division viewer role
can edit workspace-visible Issues but can only view Issues restricted to that
division. Explicit Issue grants can add view or edit access. Effective access is
the highest applicable permission.

### Division enforcement

`division_access_enabled` is a security switch, not a display preference:

```text
Disabled -> workspace roles determine broad access; division assignments are preparatory
Enabled  -> each Issue visibility, owning division, division role and grants determine access
```

The enable control remains locked until there is at least one active division,
every non-deleted Issue has an owning division, and every active non-manager
member belongs to a division. PostgreSQL rechecks readiness when the switch is
changed.

## 7. How Cloud Synchronization Works

There are three synchronization families:

| Data | Orchestrator | Neon table/API |
| --- | --- | --- |
| Core Issues | `cloudIssueSync.js` | `cloud_issues` |
| Officers | `cloudOfficerSync.js` | `cloud_officers` |
| Communications, references, milestones, summaries, drafts | `cloudIssueItemSync.js` | `cloud_issue_items` |
| Workspace and personal settings | `cloudSettingsSync.js` | two settings tables |

### Immediate writes

After a local repository saves data, it calls a queue function such as:

```js
queueCloudIssueUpsert(issue);
queueCloudIssueItemUpsert('milestone', milestone);
```

Repository saves wait for the immediate cloud attempt when cloud mode is active.
Network failures leave the local copy available and the header reports sync
status. Revision conflicts are surfaced to the user instead of being hidden.

### Full reconciliation

On startup or manual sync, cloud records normally refresh the IndexedDB working
copy automatically. Genuine local saves are tracked separately in the
`syncMutations` IndexedDB outbox:

```text
No pending mutation -> cloud refreshes IndexedDB
Pending local mutation -> upload using its expected cloud revision
Cloud deletion newer -> remove local record
```

Local timestamps are not treated as proof of a user edit. Normalization, officer
ID remapping, device clock differences and scheduled maintenance therefore do
not create false conflicts. Backup import deliberately creates outbox entries
because importing is an explicit request to restore those records.

### Tombstones

`syncTombstones` preserves deletion intent when a record is removed locally before the cloud deletion succeeds. Without tombstones, a later sync could download the deleted cloud record again.

### Simultaneous edits

`cloud_issues` and `cloud_issue_items` carry an increasing `revision`. Saves and
deletes call revision-aware PostgreSQL functions and succeed only when the
browser's expected revision is still current.

When the revisions differ:

1. Materially equivalent payloads automatically accept the latest cloud revision.
2. Legacy conflict rows without a corresponding pending mutation are cleared.
3. `cloudRevisionConflict.js` describes genuinely different local and cloud copies.
4. `syncConflictRepository.js` retains that comparison in IndexedDB.
5. `SyncConflictCenter.jsx` shows the global **Changes need review** panel.
6. `syncConflictResolution.js` applies **Keep cloud version** or retries the
   user's latest local change against the newest revision.

This prevents silent last-write-wins data loss. It is not live co-editing.

### Generic Issue child records

`src/features/cloud/cloudIssueItemSync.js` maps several local stores into one cloud table:

```js
const ITEM_CONFIG = {
  communication: { table: 'communications', normalize: normalizeCommunication },
  reference: { table: 'references', normalize: normalizeReference },
  milestone: { table: 'issueMilestones', normalize: normalizeMilestone },
  summary: { table: 'issueSummaries', normalize: normalizeIssueSummary },
  draft: { table: 'drafts', normalize: normalizeDraft },
};
```

When adding another cloud-synced child record, this map, its Data API validation and the PostgreSQL `item_type` constraint must agree.

### Settings ownership

`src/features/cloud/cloudSettingsSync.js` deliberately separates settings:

```js
function workspacePayload(settings) {
  return { categories: settings.categories, officeProfile: settings.officeProfile };
}

function userPayload(settings) {
  return { localAI: settings.localAI, reminders: settings.reminders };
}
```

The official office identity belongs to the shared workspace. Model connection and reminder choices belong to the individual user.

## 8. Neon Database and Security

### `db/migrations`

Migrations are the authoritative cloud schema. Important stages are:

| Migration | Purpose |
| --- | --- |
| `001_identity_and_access.sql` | profiles, workspaces, memberships and initial RLS helpers |
| `002_workspaces_and_cloud_issues.sql` | shared Issues and workspace permissions |
| `005_cloud_officer_directory.sql` | shared officer directory |
| `006_complete_workspace_sync.sql` | Issue child records and settings |
| `007_background_reminders.sql` | notification inbox and automation-run history |
| `009_division_access_foundation.sql` | divisions and Issue grants behind a feature flag |
| `010_shared_issue_access.sql` | effective Issue permissions and inherited RLS |
| `012_optimistic_concurrency.sql` | revision-aware saves, deletes and conflict detection |
| `013_security_and_sync_hardening.sql` | active-membership enforcement and protected child-record ownership |
| `014_preserve_last_administrators.sql` | prevents removal of the last active System or Workspace manager |
| `015_require_issue_division_when_enforced.sql` | requires an active owning division while enforcement is enabled |

### Row-level security

The browser receives a user token, not the privileged database password. PostgreSQL RLS decides which rows that user can read or change.

Conceptually:

```sql
USING (
  user_id = auth.user_id()
  AND is_active_workspace_member(workspace_id)
)
```

Never solve a browser permission problem by putting `DATABASE_URL` in frontend code. Add or adjust an RLS policy instead.

### `scripts/migrate.js` and `scripts/verify-database.js`

`migrate.js` applies ordered SQL files once and records them in `swm_migrations`. `verify-database.js` checks expected table, policy, function, trigger and migration counts.

These scripts are trusted administrative tools and use server-side `DATABASE_URL`.

## 9. Background Work and Notifications

### `vercel.json`

Defines one daily UTC schedule and a 60-second function limit:

```json
{
  "crons": [
    { "path": "/api/cron/daily", "schedule": "30 0 * * *" }
  ]
}
```

### `api/cron/daily.js`

This is the protected HTTP entry point. It accepts only Vercel's bearer secret, then calls the automation service.

```js
if (request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  return response.status(401).json({ error: 'Unauthorized' });
}

const result = await runDailyAutomation();
```

### `api/lib/dailyAutomation.js`

This is the actual backend service. It:

1. calculates the current date in India;
2. claims one `automation_runs` record for that date;
3. returns due Scheduled Issues to Pending;
4. writes a return milestone;
5. creates deduplicated deadline and digest notifications;
6. optionally sends grouped emails through Resend; and
7. records success or failure counts.

The daily claim and notification `dedupe_key` are the two main duplicate-safety mechanisms.

### Notification frontend

- `src/features/notifications/cloudNotificationApi.js` reads and marks inbox rows.
- `src/components/notifications/NotificationCenter.jsx` renders the header bell and unread list.
- reminder preferences are edited in `src/pages/SettingsPage.jsx`.

Email is optional. In-app notifications work without `RESEND_API_KEY` or `REMINDER_FROM_EMAIL`.

## 10. AI Drafting Pipeline

### `src/components/issues/AIContextPreview.jsx`

This component is the user-facing drafting workspace. It:

- lets the user select summary, communication and reference context;
- collects communication type, recipient, signatory and instruction;
- calls the Local AI service;
- shows an editable result; and
- optionally saves up to five rolling draft versions.

### `src/utils/aiContextUtils.js`

Builds the bounded Issue context supplied to the model. This is where factual context selection is turned into model-readable text.

### `src/utils/governmentDraftUtils.js`

This is the programmatic control layer for official communication. It contains:

- communication types and structural rules;
- prompt construction;
- conservative-body constraints; and
- final government-document formatting.

The core design is:

```text
Program controls document structure
  + model drafts the prose body
  + program formats the final communication
```

This reduces dependence on a small model correctly remembering Office Memorandum, D.O. Letter or Order formatting by itself.

### `src/services/lmStudioClient.js`

This is the model transport layer. `generateLocalDraft()`:

```js
const input = buildGovernmentDraftPrompt(/* office, recipient and context */);
const response = await fetch(`${baseUrl}/v1/chat/completions`, /* ... */);
return formatGovernmentCommunication(/* model body plus controlled metadata */);
```

The local Vite development server proxies `/lmstudio` to `127.0.0.1:1234`. On GitHub Pages, the browser connects directly to the user's LM Studio server with CORS enabled.

OpenAI and Gemini use protected Vercel functions under `api/ai`. Neon authorizes each request and reserves quota before provider contact. Provider keys stay in server environment variables and must never be stored in React settings or exposed through `VITE_` variables. AI logs deliberately store usage metadata rather than official prompts or generated text.

## 11. Deployment Files

| File | Purpose |
| --- | --- |
| `vite.config.js` | React/Tailwind plugins, GitHub Pages base path and LM Studio dev proxy |
| `.github/workflows/deploy-pages.yml` | builds and deploys the frontend from `main` |
| `vercel.json` | builds the Vite production application and configures serverless functions and cron |
| `.nvmrc` | selects Node 22 for local development |
| `.env.example` | documents browser-safe and server-only environment names |
| `.vercelignore` | prevents local caches and dependencies entering deployments |

Frontend variables start with `VITE_` and become visible to the browser. `DATABASE_URL`, `CRON_SECRET` and provider API keys are server-only secrets.

The same `main` branch is published to both GitHub Pages and Vercel:

- GitHub Actions builds the Pages deployment.
- Vercel production is linked to `leapfrog20/secretariat-workflow-manager`.
- `npm run build` must pass before release.
- `npm run db:migrate` and `npm run db:verify` apply and verify Neon changes.

Vercel warns that `engines.node: ">=22"` can automatically adopt future major
Node versions. `.nvmrc` pins local work to Node 22, but a future hardening pass
should consider a bounded Vercel engine range if automatic major upgrades are
not desired.

## 12. Responsive UI and Accessibility

The application uses one component tree with responsive representations:

- `IssueTable` is the desktop register; `IssueCard` is the compact mobile register.
- Portrait tablets use the mobile representation even above the old 768px
  breakpoint; landscape tablets switch the shell, register and Issue tabs to
  desktop mode together.
- The desktop/landscape sidebar can be collapsed to an icon rail. The preference
  is remembered in `localStorage`, and compact landscape tablets default to the
  collapsed state.
- Mobile Issue titles allow two lines, with eFile, stage, deadline, officer and age
  grouped into dense metadata rows.
- Search and filters share one mobile row.
- Archived pagination applies to both representations.
- `AdaptiveSelect` changes to searchable input behavior for longer option lists.
- `LoadingState` supplies stable skeleton geometry and route/data progress.
- `NavigationFeedbackProvider` acknowledges taps before lazy routes or API data arrive.

Text size is a user preference:

```text
Small / Normal / Large
  -> src/utils/appearanceUtils.js
  -> data-text-size on the document root
  -> personal cloud settings and localStorage
```

Respect `prefers-reduced-motion`: progress remains visible, but continuous
loading and shimmer animations stop.

## 13. Scaling Boundaries

The application is comfortable with hundreds to low thousands of records in the
browser, especially after Archived rendering pagination, but it is not yet
server-paged:

- `getAllIssues()` uses `db.issues.toArray()`.
- the register loads all communications for source-document search;
- cloud Issue reconciliation fetches the complete visible Issue collection; and
- child synchronization loads every local/cloud Issue item collection.

Pagination currently solves DOM and rendering cost only. The next scale phase
should add:

1. explicitly paged cloud API reads, avoiding provider row caps;
2. incremental synchronization using `updated_at`/revision cursors and tombstones;
3. indexed Dexie queries for Current, Scheduled and Archived views;
4. repository-level pagination plus separate count queries;
5. debounced or indexed communication search; and
6. pagination for notifications, administration lists and long histories.

The large main JavaScript chunk reported by Vite is another known boundary.
Continue route/dependency code splitting before adding substantial shared libraries.

## 14. Where to Make Common Changes

### Add a field to an Issue

1. Add the default/normalization in `src/utils/issueUtils.js`.
2. Add the control in `src/components/issues/IssueForm.jsx`.
3. Add an IndexedDB index only if the field must be queried directly in `database.js`.
4. Confirm `cloudIssueApi.js` still maps any required query column; the full Issue already travels in `payload`.
5. Update register/workspace display and Help where relevant.

### Add a new Issue child record type

1. Create its normalizer and local repository.
2. Add a Dexie store and increment `DB_VERSION`.
3. Add it to `ITEM_CONFIG` in `cloudIssueItemSync.js`.
4. Extend the `cloud_issue_items.item_type` PostgreSQL constraint through a new migration.
5. Add its UI to `IssueWorkspacePage` or a child tab component.

### Add a new Issue stage

Update `ISSUE_STATUSES`, then search for status comparisons in:

- `issueRepository.js`;
- `dateUtils.js`;
- `scheduleUtils.js`;
- register metrics and filters; and
- background reminder eligibility.

Pay special attention to which stages count as closed.

### Add a new notification type

1. Extend the database check constraint in a new migration.
2. Create it in `dailyAutomation.js` or another protected backend function.
3. Decide its stable `dedupe_key`.
4. Confirm the generic notification inbox wording is sufficient.

### Add a cloud AI provider

1. Create a protected Vercel endpoint under `api`.
2. Store provider credentials only in Vercel environment variables.
3. Authenticate and authorize the requesting application user.
4. Reuse `aiContextUtils` and `governmentDraftUtils` rather than creating a second drafting format.
5. Add explicit cost, consent, limits and audit handling.

## 15. Practical Reading Order

For a first deep reading, use this sequence:

1. `src/routes/AppRoutes.jsx`
2. `src/pages/IssueRegisterPage.jsx`
3. `src/pages/IssueWorkspacePage.jsx`
4. `src/pages/AdminPage.jsx`
5. `src/db/issueRepository.js`
6. `src/db/database.js`
7. `src/features/auth/ConfiguredAuthProvider.jsx`
8. `src/features/cloud/cloudIssueSync.js`
9. `src/features/cloud/cloudIssueItemSync.js`
10. `db/migrations/001_identity_and_access.sql`
11. `db/migrations/010_shared_issue_access.sql`
12. `db/migrations/012_optimistic_concurrency.sql`
13. `api/lib/dailyAutomation.js`
14. `src/components/issues/AIContextPreview.jsx`
15. `src/utils/governmentDraftUtils.js`

After these files, the remaining components should feel like implementation detail rather than a maze.

## 16. Seven Rules That Prevent Architectural Mistakes

1. Pages coordinate UI; repositories own persistence and lifecycle rules.
2. IndexedDB is the browser working copy; Neon is the shared cloud record.
3. RLS protects browser access; privileged database credentials never enter React.
4. Shared office settings and personal user settings must remain separate.
5. Official document structure belongs in deterministic code; the model supplies draft prose that the officer must verify.
6. Division and Issue permissions are enforced in PostgreSQL; UI labels and disabled controls are explanatory safeguards.
7. Client pagination is not data pagination; inspect repository and sync collection size before claiming scale.
