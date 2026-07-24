# Collaboration Guide

## Purpose of collaboration

Collaboration allows several registered users to work in the same official
workspace without automatically giving every person the same rights over every
Issue.

The intended model is:

1. A person registers and is approved.
2. The person is given access to a workspace.
3. The person may be placed in one or more divisions.
4. Each Issue is owned by a division and given a visibility rule.
5. Particular people or divisions may receive additional view or edit access.

This makes it possible to keep ordinary work easy to share while protecting
restricted matters.

## The simplest mental model

Think of the application as an office building:

- The **account** determines whether a person may enter the application.
- The **workspace** determines which office register the person may enter.
- The **workspace role** determines the person's general authority.
- The **division** identifies the normal team of the person.
- The **Issue visibility** determines which part of the office may see an Issue.
- An **explicit grant** is a special pass for one person or another division.

All these checks work together. Having an account alone does not provide access
to official Issues.

## Two different meanings of officer

This distinction is important.

### Officer directory entry

An officer saved in **Settings > Officers** is a name used for:

- allocating an Issue;
- showing who is handling it;
- selecting an authorized signatory; and
- preserving assignment history.

An officer directory entry does not create a login account and does not give
anyone access to the application.

### Registered user

A registered user is a real person with an email address and password. Only a
registered and approved user can sign in, synchronize cloud data, and receive
view or edit rights.

The same person may therefore appear in both places:

- as a registered user for access; and
- as an officer directory entry for allocation and signing.

These records are currently separate.

## Account and workspace access

There are two gates before a person can open shared work.

### Gate 1: Account status

| Status | Meaning |
| --- | --- |
| Pending | The person has registered but cannot open official work yet. |
| Active | The account is approved. |
| Suspended | Cloud access is blocked for the account. |

Only a platform administrator can approve or suspend the overall account.

### Gate 2: Workspace role

| Workspace role | Practical meaning |
| --- | --- |
| Viewer | Can read Issues made available to them but cannot change them. |
| Officer | Normal working user. Can create Issues and edit Issues for which they have edit access. |
| Workspace administrator | Can manage workspace members, divisions, sharing and workspace AI controls. |
| No workspace access | The account may remain active, but this workspace is unavailable. |

A person needs both an active account and active workspace access.

## Divisions

A division represents a practical team such as:

- Administration;
- Establishment;
- Finance;
- Vigilance;
- Parliament;
- Policy; or
- a project or subject division.

Divisions are created in **Administration > Divisions & Sharing**.

### Division roles

| Division role | What the person can do |
| --- | --- |
| Viewer | Read Issues available to that division. |
| Editor | Read and update Issues available to that division. |
| Division administrator | Highest division-level role. It can edit normal division Issues. The current Administration screen still leaves membership changes with a Workspace Administrator. |

A person may belong to more than one division. Their strongest applicable
permission is used.

For example, a person who is a Viewer in Finance but an Editor in
Administration can edit Administration Issues and only view Finance Issues.

## Issue ownership

An Issue can have an **owning division**. This answers:

> Which team is normally responsible for this matter?

Ownership is different from allocation:

- **Owning division** identifies the responsible team.
- **Assigned officer** identifies the person currently handling the work.

Changing the assigned officer does not automatically change the owning
division or sharing rights.

## Issue visibility

Every shared Issue has one of three visibility choices.

### Entire workspace

Use this for routine matters that all active workspace members may know about.

- Workspace Officers normally receive edit access.
- Workspace Viewers receive read-only access.
- The owning division still identifies responsibility.

### Owning division

Use this when the Issue should normally remain within one division.

- Division Editors and Division Administrators can edit.
- Division Viewers can read.
- Other divisions do not receive access unless a special grant is added.

### Restricted

Use this for sensitive or tightly controlled matters.

The Issue is available only to:

- workspace administrators;
- the user who created the Issue; and
- people or divisions given an explicit grant.

Restricted does not itself indicate a security classification. Users must still
follow departmental rules about classified, personal, vigilance, legal or other
sensitive information.

## Explicit sharing

Open an Issue and select **Share & Access**.

An Issue editor can give access to:

- one named workspace colleague; or
- another division.

Two permission levels are available:

| Permission | Meaning |
| --- | --- |
| Can view | The person may read the Issue and its available history but cannot change it. |
| Can edit | The person may update the Issue and its child records. |

An explicit grant supplements the normal visibility rule. The strongest
applicable permission wins.

Example:

- An Issue belongs to Administration and has **Owning division** visibility.
- Finance normally cannot see it.
- Finance Division is given **Can view** access.
- Finance members with active division membership can now read it.
- A named Finance officer may separately receive **Can edit** access.

Removing a grant removes that special access. The change takes effect in the
cloud immediately and in a user's browser at the next successful synchronization.

## Why a person can access an Issue

The **Share & Access** tab displays the user's effective permission and a simple
reason, such as:

- Workspace administrator;
- Issue creator;
- Workspace-wide visibility;
- Membership of the owning division;
- Explicit personal grant; or
- Grant through a division.

This helps distinguish normal access from exceptional sharing.

## What is shared with an Issue

Permission applies to the complete Issue workspace, not only the Issue title.

If a person can read an Issue, they can also read its available:

- current position;
- milestones and position history;
- running summary versions;
- communications and eReceipt register entries;
- references;
- saved drafts; and
- reminders or notifications linked to that Issue.

If a person can edit an Issue, they can change the records supported by their
effective edit access.

Child records inherit permission from the parent Issue. A communication or
summary cannot be shared independently while its parent Issue remains hidden.

## Collaboration and AI

Cloud AI applies two separate checks:

1. Is the person allowed to read the Issue whose context will be used?
2. Is the person allowed to use the selected AI provider?

Both checks must pass.

An AI provider may be available according to the workspace default:

- administrators only; or
- administrators and officers.

An administrator may then make an individual exception:

- **Use workspace default** means no special rule exists for that person.
- **Allow this person** permits the provider as an exception.
- **Block this person** denies the provider even if the normal workspace rule
  would allow it.

Issue sharing does not automatically provide Cloud AI access. Similarly, AI
provider permission does not allow a person to use the content of an Issue they
cannot read.

Local LLM use remains on the user's own laptop through LM Studio. The user must
still have access to the Issue in the application.

## Collaboration and notifications

Deadline notices, scheduled returns and Issue-specific reminders follow Issue
access.

A user should not receive or continue to see an Issue notification after their
access to the Issue has been removed. General digests may still appear where
they do not disclose an inaccessible Issue.

The server-side daily process also checks access before creating Issue-specific
notifications.

## Cloud synchronization and another laptop

The Neon database is the authority for:

- identity;
- workspace membership;
- divisions;
- Issue visibility;
- explicit grants; and
- effective cloud permission.

The browser keeps a local working copy for speed. After synchronization:

- newly shared Issues are downloaded;
- permitted updates are exchanged;
- child records follow their parent Issue; and
- previously visible Issues that are no longer available are removed from the
  local cache with their child records.

Revocation takes effect on a connected device at the next successful
synchronization.

### Offline limitation

A web application cannot remotely erase a device that is disconnected from the
network. A previously synchronized local copy may remain on an offline device
until that device reconnects and synchronizes.

For highly sensitive deployments, persistent offline storage should be disabled
or controlled through an enterprise device policy. Users should also sign out
of shared computers.

## Enabling division enforcement

Division collaboration is introduced carefully so existing users are not
unexpectedly locked out.

Before enforcement is enabled, active workspace members retain the earlier
workspace-wide behavior.

An administrator should complete these steps:

1. Create the required divisions.
2. Assign active non-administrator workspace users to their divisions.
3. Assign every existing Issue to an owning division.
4. Review the visibility of sensitive Issues.
5. Add any cross-division or named access grants.
6. Check the readiness report.
7. Enable division access only when the report shows no unassigned Issues or
   users.

The application prevents activation when the readiness check has not passed.

Enforcement may be paused by a workspace administrator if access arrangements
need to be reorganized. Pausing restores workspace-wide behavior; it does not
delete divisions or grants.

## Audit trail

The application records access-policy changes such as:

- enabling or pausing division enforcement;
- changing an Issue's owning division or visibility; and
- adding, changing or removing an explicit grant.

The access audit records who acted and what permission changed. It does not
store the Issue's substantive content in the audit event.

## A recommended practical setup

For a small office, start simply:

1. Keep one verified platform administrator.
2. Give one or two responsible users the Workspace Administrator role.
3. Add ordinary users as Officers.
4. Create only the real working divisions, not every possible organizational
   label.
5. Use **Entire workspace** for ordinary matters.
6. Use **Owning division** where team separation is useful.
7. Use **Restricted** sparingly for matters that genuinely need named access.
8. Prefer division grants over many individual grants when a whole team needs
   the same access.
9. Review membership during transfers, leave, role changes and handovers.

This keeps the system understandable while leaving room for more detailed
control later.

## What collaboration currently does not provide

The current implementation does not yet provide:

- email invitations that automatically create accounts;
- live cursor-style co-editing;
- comments directed at another user with mentions;
- an approval workflow for permission requests;
- a user-facing expiry date for temporary access;
- encrypted offline storage managed by an organization;
- remote erasure of a disconnected device.

## What happens when two people edit together

Each cloud Issue and its summaries, communications, references, milestones and
drafts carries a revision number. The application sends the revision the user
originally opened whenever it saves or deletes a record.

If another person has already saved a newer revision, the database rejects the
stale change. The user's work remains in the browser and a **Changes need
review** panel appears at the top of the application.

The user then makes one clear choice:

- **Keep cloud version** replaces the browser copy with the colleague's latest
  version.
- **Use my change** checks the latest cloud revision again and saves the user's
  current browser copy as the next revision.

If someone changes the record again before the second choice completes, the
system raises another conflict instead of overwriting that newer work. This is
deliberate conflict handling, not live co-editing: users do not see each other's
keystrokes while typing.

## Quick examples

### Routine shared Issue

- Visibility: Entire workspace
- Owning division: Administration
- Result: Officers can work on it; Viewers can read it.

### Division-only Issue

- Visibility: Owning division
- Owning division: Finance
- Result: Finance members receive access according to their division role.

### Restricted Issue shared for comments

- Visibility: Restricted
- Owning division: Vigilance
- Grant: Vigilance Division - Can edit
- Grant: Legal Division - Can view
- Grant: Named Legal Officer - Can edit
- Result: Only administrators, the creator and the explicitly granted Vigilance
  and Legal recipients can open it. A Restricted Issue does not automatically
  become visible to its owning division.

### Officer transferred to another division

1. Add the person to the new division.
2. Reassign or hand over relevant Issues.
3. Remove or suspend the old division membership.
4. Remove any personal grants that are no longer required.
5. Ask the user to synchronize.

## Summary

Collaboration is designed to answer four questions clearly:

1. **Who is the person?** Account approval.
2. **Which shared office may they enter?** Workspace membership.
3. **Which Issues may they see?** Division, visibility and explicit grants.
4. **What may they do with those Issues?** Viewer or editor permission.

The default should remain simple. Use broader workspace access for routine work,
division access for normal team boundaries, and restricted sharing only where
the subject genuinely requires it.
