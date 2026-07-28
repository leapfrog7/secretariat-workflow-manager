# Report Generation Module

## Purpose

Reports should help an officer understand and communicate the position of work
without first learning a complicated reporting tool. A useful report must still
be available when no AI provider is configured. AI may improve wording and draw
attention to patterns, but it must not become the source of official facts.

Every report is limited to Issues the signed-in user can already access. In the
cloud application, this visible set is supplied by the existing Issue RLS and
synchronisation rules.

## Delivery phases

### Phase 1: Operational snapshot

Status: implemented.

- Add a dedicated Reports page.
- Generate a report from the current local workspace without an API call.
- Provide three plain-language views: Current position, Attention required and
  Completed work.
- Filter by owning division.
- Show workload totals, stage distribution, deadline risks, unassigned work and
  concise rule-based observations.
- Let the user include or omit recorded current-position text.
- Support printing and editable Microsoft Word `.docx` export.
- Keep the mobile navigation to four primary choices by moving Help into More.

The Phase 1 report is explicitly an "as on" snapshot. It does not claim to show
activity during an earlier period because that requires history records.

### Phase 2: Weekly and monthly progress

Status: implemented.

- Build activity reports from milestones, communications, eReceipts and summary
  versions within a selected date range.
- Provide Weekly, Monthly and Custom period presets.
- Separate opening position, developments during the period, work completed,
  slippages and next-period priorities.
- Allow a user to select Issues before export and add a short covering note.
- Allow the user to include or omit opening position, dated developments, the
  latest running summary available by the period end, and next-period
  priorities independently.
- Add CSV export for register-style analysis.
- Add tests for period boundaries, time zones and recurring Issues.

Weekly reports cover the last seven calendar dates, including both the first and
last date. Monthly reports cover the first day of the current month through
today. Custom reports use the two dates selected by the user. Date-only official
records retain their recorded date; timestamped history is grouped using the
`Asia/Kolkata` time zone.

Only Issues with a development, completion or reportable slippage in the period
are offered for inclusion. All are selected initially. Clearing a selection
removes that Issue from the preview totals and from both Word and CSV exports.
Content controls are also enforced when building Word, CSV and AI input, so
clearing a content type removes its text from the generated output rather than
merely hiding it on screen.

**Developments during the period** contains milestone position updates only.
Communication and eReceipt activity remains available through dedicated counts,
and the latest running-summary text appears only in the separate Running Summary
section. Summary-version events are never inserted into the developments
timeline.

### Phase 3: Optional AI refinement

Status: implemented.

- Add Improve with AI after the deterministic report is generated.
- Allow Local LLM or an administrator-enabled cloud provider.
- Send the structured report and selected supporting context only after explicit
  confirmation for cloud AI.
- Ask AI to improve narrative, identify patterns and suggest an executive
  summary while preserving every number, date, title and attribution.
- Show deterministic and AI-refined versions separately so the user can review
  changes or return to the source report.
- Log provider, model, operation, usage and outcome without storing report
  content unnecessarily.

The AI version never replaces the deterministic report. **Source report** and
**AI refinement** remain separate views, and changing the report scope, dates,
Issue selection or source history discards the stale refinement. Word export and
printing use the version currently shown.

Cloud refinement requires migrations `017_cloud_ai_report_operation.sql` and
`018_report_permission_hardening.sql`. Every
included Issue is rechecked against current server-side access before its context
is sent. The generation log records the `report` operation, provider, model,
usage and outcome, but not the prompt or generated report text.

### Phase 4: Governed recurring reports

- Save report definitions, not silent copies of sensitive report content.
- Schedule weekly or monthly generation through the backend.
- Add review and approval, controlled recipients and division-level templates.
- Record who generated, edited, approved and exported a report.
- Support workspace branding and approved formats.
- Add retention controls and notification delivery.

## Design rules

- Default to a useful report with no setup.
- Use official data as the authority; generated prose cannot alter facts.
- Call a snapshot a snapshot and an activity report an activity report.
- Never expose Issues outside the user's effective access.
- Prefer reviewable output over automatic external distribution.
- Keep configuration progressive: common choices first, advanced controls later.
