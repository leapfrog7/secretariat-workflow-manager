# Casework Architecture

## Decision

Casework is a top-level work surface, but every Note and Draft remains a child of
an Issue. The user enters **Casework**, selects an Issue, and the application
loads that Issue's running summary, current position, Notes, references and
communications. This improves daily navigation without creating free-floating
official records or a second permission model.

The stable deep link is `/casework/:issueId`. Access is recalculated with the
same effective Issue permission used by the Issue workspace. Notes, Drafts and
communications continue to inherit their parent Issue's Neon RLS policy.

`src/features/casework/CaseworkModule.jsx` is the only composition layer for
Noting and Drafting. The top-level Casework page renders this module; the Issue
workspace links to its stable deep link. Provider selection, AI context
assembly, save behavior and revision rules must not be forked by route.

## Delivery Phases

### Phase 1: Independent entry point - implemented

- Add searchable Issue selection and stable Casework deep links.
- Reuse the existing Note and Draft repositories and effective permissions.
- Add Casework to desktop navigation.
- Keep five mobile destinations: Issues, Casework, Create, Reports and More.
- Retain the Issue Casework tab temporarily during Phase 1 to avoid breaking
  familiar links.

### Phase 2: Work resumption and simplification - implemented

- A compact recent Casework list shows the latest saved Note and Draft activity.
- Deep links open the selected Note or saved Draft directly.
- The former Issue Casework tab is replaced by one clear **Open Casework** action.
- Browser back behavior and unsaved-change protection remain active during Issue
  switching.

### Phase 3: Scale and operational visibility - implemented

- Workspaces with more than 100 current Issues use paged, access-checked Neon
  search and fall back to the synchronized local copy when it is unavailable.
- The Casework home provides Recent and Awaiting queues derived from existing
  Notes, Drafts and Issue stages rather than a new workflow status model.
- Targeted telemetry records load, search and AI handoff failures without
  storing Issue text, prompts, generated text or attached source material.

Cloud Phase 3 support requires migration `025_casework_scale_and_telemetry.sql`.
Until it is applied, large workspaces automatically use local search.

## Reliability Rules

- Casework must never exist without an Issue ID.
- A route must fail closed when the Issue is no longer visible to the user.
- Cloud sync and AI authorization continue to recheck Issue access.
- Switching Issues must not allow an older asynchronous load to replace the
  newly selected Issue.
- Unsaved Note or Draft changes must block route changes until the user confirms
  that they may be discarded.
