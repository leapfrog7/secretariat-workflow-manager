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
Issue content in the audit event.

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

### Concurrency

Cloud rows use `updated_at` for current synchronization. Before broad
collaboration is enabled, editable records should gain a revision number or
ETag-style compare-and-swap check. A stale update must produce a conflict for
human review instead of silently overwriting a colleague's newer work.

## Delivery Phases

Current implementation status:

- Phase 0 is implemented in the application.
- Phase 1 application controls are implemented. Migration
  `009_division_access_foundation.sql` prepares the disabled database foundation
  and must be applied through the normal migration process before Phase 2 work.
- Phases 2 through 4 are not yet implemented.

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

- Add optimistic concurrency and conflict resolution.
- Add access-change audit views and notifications.
- Add temporary access expiry, handover and bulk division reassignment.
- Test revocation, suspended users, cross-division sharing and offline recovery.

Do not enable division enforcement before Phase 3 is complete. A partially
enforced model is less safe than the current explicit workspace-wide model.
