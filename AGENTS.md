# Secretariat Workflow Manager: Engineering Notes

## Collaboration And Access Architecture

The application is local-first, but Neon is the authority for identity, membership,
sharing and permissions. Frontend controls improve usability; they are never the
security boundary. Every cloud read or write must also be enforced by Postgres row
level security (RLS).

### Access hierarchy

1. **Platform role**
   - `platform_admin`: operates the service and approves accounts.
   - `user`: has no official data access until added to a workspace.
   - Platform administration is not an official-data bypass. A platform
     administrator needs an active membership in a workspace to read or edit its
     Issues.
2. **Workspace role**
   - `workspace_admin`: manages workspace users, divisions and policy.
   - `officer`: may create Issues and receives access through a division or grant.
   - `viewer`: read-only workspace membership; it does not by itself grant access
     to every Issue once division access is enabled.
3. **Division membership**
   - `division_admin`: manages membership and sharing within that division.
   - `editor`: may edit Issues available to the division.
   - `viewer`: may read Issues available to the division.
4. **Issue access**
   - Every Issue has an owning division and a visibility mode.
   - `division`: available to active members of the owning division.
   - `workspace`: available to all active workspace members, subject to their
     workspace role.
   - `restricted`: available only to workspace administrators, the creator and
     explicit user or division grants.
   - Explicit grants provide `viewer` or `editor` access to a user or division.
   - Effective access is the highest applicable permission. A suspended account,
     workspace membership or division membership always removes access.

### Sharing workflow

An Issue editor selects **Share and access**, chooses its owning division and
visibility, then optionally grants another division or named workspace member
view or edit access. Workspace administrators may change all access. Division
administrators may manage Issues owned by their division. Ordinary editors may
share only when the Issue policy permits it.

The UI must show who can access an Issue and why, for example `Editor through
Administration Division`. Permission changes must be audited without storing
Issue content in the audit event. At the current implementation stage, only
workspace administrators and the administrator of the owning division may
change Issue ownership, visibility or explicit grants. Content editors cannot
delegate their access onward.

### Security and local cache

- RLS functions such as `can_read_issue` and `can_edit_issue` protect
  `cloud_issues`, `cloud_issue_items`, reminders and AI operations.
- Child records inherit access from their parent Issue. They must never use only
  workspace membership as their read policy.
- The browser cache is scoped by user and workspace. After every successful sync,
  the server returns the complete set of Issue IDs currently visible to that user.
  Cached cloud Issues absent from that authoritative set are purged with their
  communications, references, milestones, summaries and drafts.
- An access revocation takes effect at the next online sync. Highly sensitive
  deployments should disable persistent offline storage or encrypt it through an
  enterprise-managed key; a web application cannot remotely erase a disconnected
  device.
- Viewer mode disables mutating controls locally as well as relying on RLS.
- Access checks happen again when Cloud AI is called so a stale browser cannot
  send context from an Issue the user may no longer read.
- Cloud collections are read in counted pages. A partial or uncounted response
  must fail synchronization before authoritative Issue IDs are used to purge
  the local cache.

### Concurrency

Cloud rows use `updated_at` for current synchronization. Before broad
collaboration is enabled, editable records should gain a revision number or
ETag-style compare-and-swap check. A stale update must produce a conflict for
human review instead of silently overwriting a colleague's newer work.

## Delivery Phases

Current implementation status:

- Phases 0 through 3 are implemented in the application.
- Migrations `009_division_access_foundation.sql`,
  `010_shared_issue_access.sql`, `012_optimistic_concurrency.sql` and
  `013_security_and_sync_hardening.sql` must be applied through the normal
  migration process before using collaboration controls.
- Migrations `017_cloud_ai_report_operation.sql` and
  `018_report_permission_hardening.sql` must be applied before Cloud AI
  report refinement is enabled. Local LLM report refinement does not require it.
- Migration `019_paragraph_bank.sql` must be applied before cloud Paragraph
  Bank synchronization is enabled.
- Migration `020_draft_snapshot_retention.sql` must be applied before relying on
  cloud draft retention across multiple clients.
- Migration `021_issue_notes.sql` must be applied before cloud Noting and note
  revision synchronization are enabled.
- Migration `022_workspace_provisioning_and_isolation.sql` must be applied before
  using independent workspace provisioning. Account approval and workspace
  membership remain distinct permissions even when committed together.
- Migration `023_administration_workspace_directory.sql` permits platform
  administrators to read workspace and membership metadata for the access
  directory. It must not grant access to Issue content.
- Migration `024_admin_approve_and_assign_workspace.sql` atomically activates a
  pending account and its selected primary workspace role. Previous active
  memberships are suspended when a user is transferred.
- Migration `025_casework_scale_and_telemetry.sql` adds access-checked paged
  Casework search and content-free operational failure events. The client must
  retain local search as its offline and pre-migration fallback.
- Migration `026_workspace_configuration_hardening.sql` restricts the officer
  directory and shared office profile to workspace administrators and adds
  revision-checked workspace-setting saves. Apply it before deploying clients
  that use the hardened settings synchronization contract.
- Division enforcement remains off until a workspace administrator creates
  divisions, assigns active members and Issues, passes the readiness report, and
  explicitly enables it.
- Phase 4 optimistic concurrency and human conflict resolution are implemented.
  Access audit views, notifications and handover tools remain future work.

### Phase 0: Record safety

- Delete individual running-summary versions with confirmation.
- Sync deletions through the existing item tombstone mechanism.
- Recalculate the latest summary after deletion.

### Phase 1: Collaboration foundation

- Expose the existing workspace role as `canEdit` in application context.
- Disable Issue mutations for workspace viewers.
- Add division, division membership and Issue-grant schema behind a workspace
  feature flag that defaults off.
- Preserve current workspace-wide behavior until an administrator explicitly
  enables division access after assigning users and Issues.

### Phase 2: Division administration

- Add administrator screens for divisions and membership.
- Add an owning-division field to Issue creation and details.
- Provide a readiness report for unassigned users and Issues.
- Enable division access only when the readiness report passes.

### Phase 3: Issue sharing and enforcement

- Add the Share and access panel.
- Replace workspace-wide Issue RLS with effective Issue permission policies.
- Apply inherited policies to Issue child records, reminders and Cloud AI.
- Purge inaccessible records from the local cache after authoritative sync.

### Phase 4: Collaboration hardening

- Optimistic concurrency and conflict resolution are implemented for Issues,
  communications, references, milestones, summaries and drafts. Cloud rows use
  monotonic revisions; stale saves and deletes are retained locally and shown in
  a global review panel with **Keep cloud version** and **Use my change** actions.
- Active profile and workspace membership are required for every non-platform
  Issue access path. Privileged item saves cannot move a child record between
  Issues, and view-only browser caches are overwritten by the cloud authority.
- Add access-change audit views and notifications.
- Add temporary access expiry, handover and bulk division reassignment.
- Test revocation, suspended users, cross-division sharing and offline recovery.

Do not enable division enforcement before Phase 3 is complete. A partially
enforced model is less safe than the current explicit workspace-wide model.

## Drafting Architecture

Official drafting follows the architecture in `DRAFTING_ARCHITECTURE.md`.
AI providers generate substantive body language only. CSMOP-oriented structure,
formatting, identity, validation, versioning and export remain deterministic
application responsibilities. Structured draft changes must remain compatible
with existing plain-text versions throughout the phased migration.

Paragraph Bank entries are independent workspace resources rather than Issue
children. Personal entries are visible and manageable only by their owner.
Shared entries are readable by active workspace members and may be published,
edited or deleted only by workspace administrators. The browser cache remains
user/workspace scoped, and stale saves use revision checks rather than
overwriting cloud wording.

Local and Cloud drafting must use the provider-independent orchestrator under
`src/features/drafting/ai`. Provider clients own transport only; they must not
assemble official documents or maintain separate drafting prompts. AI output
may create or replace substantive `bodyParagraph` blocks only. Deterministic
templates remain responsible for subjects, headings, addressees, signatures,
copy lists and formatting. Selected-passage AI operations must reject
selections outside the computed body range and must never overwrite a
free-text-edited draft.

Ordinary **Save** updates the current mutable draft and does not create routine
version noise. **Save as separate version** creates an immutable snapshot with
its base draft ID and version. Editing an immutable snapshot creates a new
mutable working draft instead of changing the preserved copy. Retain no more
than the five newest active draft records per Issue in both the local repository
and Postgres. Recording an outgoing communication must first preserve the exact
issued draft as an immutable snapshot.

New structured drafts store normalized rich-text JSON for body paragraphs while
retaining plain body blocks for compatibility and AI context. Do not persist
arbitrary editor HTML. Formatting controls apply only to the substantive body;
template-owned headings, subjects, recipients and signatures remain protected.
Rich editor dependencies must be lazy-loaded so ordinary Issue navigation does
not absorb the editor bundle.

## Noting Architecture

Noting is an Issue child resource and inherits the same read, edit, revocation
and optimistic-concurrency rules as communications, references, summaries and
drafts. Cloud support requires migration `021_issue_notes.sql`; do not rely on
local-only notes in a collaborative workspace.

Notes are chronological, content-focused records rather than workflow routing
objects. Each note stores normalized rich-text JSON, a plain-text projection for
search and AI context, optional appendix material, and links to relevant
communications and references. Arbitrary HTML must not be persisted.

Editors may revise a note after discussion, but a save must append an immutable
snapshot of the previous wording and attribution before replacing the current
version. The UI must expose that history. This flexibility must not become a
silent overwrite path.

Noting AI remains optional. The provider-independent note contract supports
generation and refinement in concise Government noting style. It must not
invent file facts, approvals or decisions, and its result remains an editable
preview until the user saves it. Attribution, chronology and revision storage
remain deterministic application responsibilities. Selected notes may also be
supplied to Drafting context when preparing a communication.

## Casework Navigation Architecture

Follow `CASEWORK_ARCHITECTURE.md`. Casework is a top-level work surface, while
Notes and Drafts remain Issue children. `/casework/:issueId` may change how a
user reaches the work, but it must not introduce free-floating records, bypass
Issue RLS, or duplicate the Noting and Drafting orchestration. The top-level
page renders the shared Casework module; the Issue workspace provides a clear
deep link instead of embedding a second copy of the workflow.

## Cloud Run Migration

The protected API is being migrated from Vercel Functions to Google Cloud Run
because the production `vercel.app` API origin is unavailable on the target
office network. Follow `CLOUD_RUN_DEPLOYMENT.md`.

`server/apiServer.js` is the portable HTTP adapter and must continue routing the
existing handlers under `api/`; do not fork AI authorization, quota or logging
logic by hosting provider. `server/cloudRun.js` is the Cloud Run entry point,
while local development uses the same adapter. GitHub Pages remains the
frontend and Neon remains the authority for authentication, permissions and AI
usage reservation.

Do not change `VITE_API_BASE_URL` until the Cloud Run health, authentication,
Gemini generation and Neon logging checks all pass. Retain Vercel as a rollback
during the initial cutover. Migrate the daily scheduler only after interactive
AI traffic is stable.
