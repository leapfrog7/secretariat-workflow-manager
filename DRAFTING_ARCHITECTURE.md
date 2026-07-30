# Drafting Architecture

## Purpose

The drafting module prepares official communications from an Issue without
allowing an AI provider to control document structure, formatting, identity or
permissions. AI generates or rewrites substantive body language only. The
application owns CSMOP-oriented templates, metadata, rendering, validation,
version history and export.

## Core boundaries

1. `DraftingWorkspace` owns the user workflow: setup, sources, composition,
   paragraph bank, versions and export.
   Users may start from the deterministic blank template or ask AI to prepare
   only the substantive body; AI is never required to open the editor.
2. The draft domain stores a versioned semantic document. Saved drafts retain a
   plain-text compatibility copy until the legacy editor has been retired.
   Schema version 2 adds normalized rich-text JSON for substantive body
   paragraphs. Plain body blocks remain available for search, AI context and
   older clients; arbitrary HTML is never persisted.
3. The template registry defines block order and presentation for each form of
   communication. Templates are versioned code, not model prompts or arbitrary
   database HTML.
4. Renderers consume the same semantic document for browser preview, plain text
   and DOCX. Formatting must not be inferred from spaces or blank lines.
5. The AI orchestrator receives selected Issue context and returns body content
   or a replacement for selected body blocks. It cannot generate sender
   identity, subject formatting, signature, recipient blocks or distribution.

Legacy saved drafts continue to open in the plain-text compatibility editor.
New manual and AI drafts use the structured editor and the versioned semantic
document model.

The structured editor exposes formatting only for the substantive body. Official
headings, numbers, dates, subjects, recipient blocks and signatures are rendered
from protected metadata and templates. Supported body formatting is deliberately
small: bold, italic, underline, bullets, numbering and paragraph alignment.
Document-wide font, size, line spacing and paragraph spacing are stored in the
style snapshot.

The editor shell keeps its toolbar outside the paper canvas. A responsive Draft
tools rail sits beside the document on desktop and opens as a drawer on mobile.
Its Details tab allows protected metadata such as communication number, date,
subject, recipient, communication type and signatory to be completed or
corrected during drafting without regenerating the substantive body. Its
The editor Bank rail inserts normal entries at the retained editor selection.
Entries in the `Address / addressee` category update recipient metadata and are
therefore rendered through the protected template rather than inserted into
body prose.

## Draft document

Every structured draft has:

- `schemaVersion`
- `templateId` and `templateVersion`
- metadata such as subject, communication number, date, recipient and signatory
- stable semantic blocks with `role`, `content` and `source`
- a style-profile snapshot so later setting changes do not alter saved versions

Block sources are `template`, `user`, `ai`, `paragraph-bank` or `legacy`.
Legacy drafts are represented by one `legacyDocument` block and keep their
original text exactly. Conversion is lazy and non-destructive.

## Permissions

- Issue viewers may read and export saved drafts available through the parent
  Issue.
- Issue editors may create, edit, save and record outgoing drafts.
- Cloud AI use also requires the separate provider permission and a fresh
  server-side Issue access check.
- Personal paragraph-bank entries are visible to their owner. Published
  workspace entries are readable by active workspace members and manageable by
  workspace administrators. Division scope may be added after usage justifies
  the additional policy surface.
- Workspace administrators manage the default document style. A saved draft
  stores an immutable style snapshot.

All cloud policies are enforced by Postgres RLS. Frontend controls are only a
usability layer.

## Versioning and compatibility

- The existing maximum of five saved versions remains.
- Structured fields are additive to the current draft payload.
- Old clients continue reading `content`; new clients prefer `document`.
- Ordinary Save updates the current mutable draft. This keeps routine editing
  from producing unnecessary versions.
- Save as separate version creates an immutable snapshot. Editing a preserved
  snapshot creates a new mutable draft with lineage instead of altering it.
- Unsaved working state remains mounted while the user moves between tabs in the
  same Issue workspace. Leaving or reloading the page triggers the browser's
  unsaved-change warning.
- Recording an outgoing communication must preserve the exact text or document
  snapshot even if an old rolling draft version is later removed.
- Template upgrades never silently restyle an existing saved version.

## Delivery phases

Implementation status: phases 1 through 9 are complete. Workspace document
styles are available; a distinct personal style override remains optional
future work rather than a prerequisite for the Paragraph Bank.

1. Architecture, template contracts and compatibility schema.
2. Dedicated Drafting workspace with the existing generation behavior.
3. Structured editor, deterministic preview, validation and DOCX renderer.
4. Workspace and personal style profiles.
5. Cloud-synced Paragraph Bank with scoped permissions.
6. Provider-independent AI body-block orchestration.
7. Explicit working-copy/version flow, migration hardening and mobile polish.
8. Protected rich-text body editor with formatting-aware DOCX export.
9. Non-blocking draft-readiness review for missing structured details and
   unresolved placeholders.

Migration `020_draft_snapshot_retention.sql` enforces the five-snapshot limit in
Postgres as well as in IndexedDB. This protects retention when several clients
save near the same time.

## AI orchestration

Local LM Studio and Cloud AI implement the same small provider contract:
`generateText({ operation, instructions, input, signal })`. Provider adapters
handle transport, authentication, model selection and usage metadata. The
orchestrator owns prompts, output normalization, semantic body blocks and
deterministic document rendering.

The model never receives authority to construct the complete document.
Generation creates `bodyParagraph` blocks and the application adds the subject,
heading, addressee, signature and other template blocks. Selected-passage
regeneration is permitted only when the selection falls inside the computed
substantive-body range. Free-text drafts cannot be silently converted or
overwritten by body-only AI tools.

Each phase must retain Local LLM and Cloud AI operation and pass legacy-draft,
template, permission, synchronization and export tests before rollout.
