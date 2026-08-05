# Secretariat Workflow Manager

Secretariat Workflow Manager is a React application for tracking government-secretariat Issues from receipt to closure. It keeps the present position easy to see while preserving milestones, communications, eReceipts, references and running summaries for later review and AI-assisted drafting.

**Live application:** [leapfrog7.github.io/secretariat-workflow-manager](https://leapfrog7.github.io/secretariat-workflow-manager/)

The project is currently a working multi-user proof of concept. Neon provides authentication, workspace access and complete operational workspace synchronisation, while IndexedDB remains the responsive local cache and backup source.

## Implemented Features

### Issue management

- Create an Issue with a title and optional deadline, assigned officer, subject type, eFile number, category and priority.
- Use the lifecycle stages Pending, In Progress, Awaiting Input, Awaiting Discussion, Completed, Cancelled and Deferred.
- View workload indicators for total, pending, overdue, in-progress and awaiting-discussion Issues.
- Search Issues and linked eReceipt or source-document metadata.
- Track Issue age, deadline position and assigned officer in the register.
- Archive completed or inactive Issues and restore them when further work arrives.
- Schedule one-time, weekly or monthly work to return to the current register as Pending.
- Reactivate scheduled Issues through a protected daily Vercel job, even when the application is closed.
- Use a compact Current, Scheduled and Archived register with direct row actions.
- Receive in-app deadline, overdue, return and weekly or monthly digest notifications.
- Enable optional email delivery when a Resend account and sending domain are configured.

### Issue workspace

- Preserve every Current Position update as a dated milestone instead of overwriting history.
- Maintain versioned running summaries.
- Record incoming, outgoing and internal communications chronologically.
- Register multiple eReceipts and source-document metadata without storing the original files.
- Capture references such as Office Memoranda, rules, instructions and court directions.
- Use Casework to move freely between internal examination and preparation of
  an official communication.
- Notes support lists, tables, linked sources, retained revision history,
  plain-language AI assistance and optional request-only Word or text context.
  Word (.docx), text (.txt or .md), and text PDFs are read in the browser. The
  PDF importer removes repeated headers and footers and conservatively
  reconstructs common headings, numbered paragraphs and simple tables. Scanned
  pages can be recognized locally using packaged English, Hindi or bilingual OCR
  before the user reviews the extracted text.
- Reuse approved wording from the searchable Paragraph Bank. Personal entries remain private; workspace administrators can publish shared entries for all active members.

### Official drafting

- Configure the Ministry or Department, office details, house style and authorised signatories.
- Prepare Office Memoranda, D.O. Letters, Letters, Office Orders, Orders, I.D. Notes and related forms.
- Assemble the official document structure programmatically and ask the model to draft the body.
- Start a blank, programmatically structured communication and write it entirely without AI.
- Format the substantive body with bold, italic, underline, lists and paragraph alignment while official headings, subjects, addressees and signatures remain protected.
- Choose a document font, font size, line spacing and paragraph spacing in the editor; these settings are retained in saved versions and editable Word exports.
- Use the in-editor Draft tools rail to complete or correct the communication number, date, subject, addressee, signatory and related document details while drafting. Changes appear immediately without regenerating the body.
- Use the Draft More menu to change an existing structured draft from Letter to
  Office Memorandum or another supported communication type without losing its
  substantive body.
- Switch the same rail to Paragraph Bank to insert approved wording at the current cursor. Entries categorized as Address / addressee populate the protected recipient-address block.
- Use the Review tab before issue to find missing structured details and unresolved placeholders without blocking early drafting.
- Route Local LM Studio and Cloud API drafting through the same body-only orchestration layer, keeping subjects, addressees and signatures outside model control.
- Generate through LM Studio on the user's laptop or an administrator-approved OpenAI/Gemini API.
- Edit and copy a generated draft without saving it automatically.
- Save routine changes into the current draft, or intentionally retain a separate version. Up to five draft records per Issue carry communication type and signatory metadata.
- Export editable Word `.docx` files, regenerate a selected passage and convert a saved draft into a linked outgoing communication record.

Generated text is a drafting aid. The responsible officer must verify facts, citations, authority, classification, tone and approvals before issuing a communication.

### Reports

- Generate an operational snapshot without requiring AI or an API connection.
- Switch between Current position, Attention required and Completed work views.
- Produce weekly, month-to-date or custom-period progress reports from milestones, communications, eReceipts and running-summary versions.
- Separate opening position, milestone position developments, running summary, completed work, slippages and next-period priorities.
- Include or exclude individual Issues and add an optional covering note.
- Independently include opening position, dated developments, the latest running summary available by period end, and next-period priorities.
- Limit a report to an owning division while retaining the user's existing Issue-access boundary.
- Review automatic deadline, allocation and stage observations.
- Include or omit current-position text, print a clean report and download an editable Microsoft Word `.docx` file.
- Export period activity as CSV for register-style analysis.
- Optionally improve report structure through LM Studio or an administrator-enabled Cloud API while retaining the deterministic source report for verification.
- Recheck access to every included Issue before Cloud AI receives report context and log report usage without storing report text in the AI log.

See [REPORTING_MODULE.md](REPORTING_MODULE.md) for the phased path to weekly/monthly activity reports, optional AI refinement and governed recurring distribution.

### Accounts and administration

- Register and sign in through Neon Auth.
- Hold new registrations for administrator approval.
- Require both an active account and active workspace membership.
- Approve, suspend and restore users from the Administration page.
- Approve a pending account and assign its primary workspace and starting role
  in one atomic administrative action.
- Keep one active primary workspace per user at this stage. Changing placement
  suspends previous memberships without moving any Issues.
- Provision an independent workspace for a separate person or office and remove
  their access to the administrator's current workspace in one operation.
- Review each person's account state, system authority and active workspace
  assignments in the Administration access directory.
- Protect cloud tables with PostgreSQL row-level security policies.

Platform administration controls accounts and workspace provisioning. It does
not itself grant access to official Issues; all operational access requires an
active membership in the relevant workspace.

## Architecture

```text
GitHub Pages
  React + Vite + Tailwind CSS
          |
          +-- Neon Auth: registration and sessions
          +-- Neon Data API: profiles, workspaces and shared data
          +-- IndexedDB/Dexie: local working data and offline cache
          +-- LM Studio: optional local draft generation
          +-- Vercel AI API: authenticated OpenAI/Gemini generation

Vercel scheduled function
          +-- Neon: scheduled reactivation, reminders and durable run history
          +-- Resend: optional reminder email delivery

Local administration scripts
          +-- DATABASE_URL: migrations, verification and bootstrap tasks
```

There is no always-running Express server. The browser communicates with Neon Auth and the Neon Data API, while protected Vercel functions handle scheduled work and Cloud AI calls. PostgreSQL functions and row-level security enforce account, workspace and AI permissions. Administrative scripts connect directly to PostgreSQL using `DATABASE_URL` and must only be run from a trusted environment.

### Data location

| Data | Current storage |
| --- | --- |
| Accounts, profiles and workspace memberships | Neon |
| Core Issue details, stage, assignment, deadlines, recurrence and archive state | Neon plus local IndexedDB cache |
| Officer directory | Neon plus local IndexedDB cache |
| Milestones and running-summary versions | Neon plus local IndexedDB cache |
| Communications, eReceipt metadata and references | Neon plus local IndexedDB cache |
| Office profile and authorised-signatory selection | Neon workspace settings plus local cache |
| LM Studio URL and local model | Device-local IndexedDB only |
| Cloud AI preference, reminders and appearance | Neon user settings plus local cache |
| Notification inbox and automation run history | Neon |
| PDFs selected for AI context | Processed in browser memory; neither the PDF nor the transient converted Markdown is stored |
| Generated drafts | Versioned Issue records in Neon plus local cache |

The cloud control in the application header reconciles the complete Issue workspace in counted pages. A partial cloud response is rejected before the application treats it as authoritative. IndexedDB remains the responsive local working copy, and JSON export remains available for recovery and portability.

When the browser reports that the network is offline, the application clearly
retains work in the local cache. It attempts a normal authenticated workspace
synchronization after connectivity returns; the cloud status panel shows queued
changes, conflicts, the last successful sync and any failure requiring action.

## Technology

- React 19 and React Router
- Vite 8
- Tailwind CSS 4
- Dexie and IndexedDB
- Neon Auth, PostgreSQL and the Neon Data API
- `@neondatabase/serverless` for administration scripts
- Vercel Functions and Cron for daily background work
- LM Studio's OpenAI-compatible local API
- Lucide icons and date-fns

## Local Development

### Requirements

- Node.js 22 or newer
- npm
- A modern browser
- A Neon project with Auth and the Data API when testing cloud mode
- LM Studio only when testing local AI drafting

### Install and configure

```powershell
npm install
Copy-Item .env.example .env.local
```

Set these values in `.env.local`:

```dotenv
VITE_NEON_AUTH_URL=https://your-project.neonauth.example/neondb/auth
VITE_NEON_DATA_API_URL=https://your-project.apirest.example/neondb/rest/v1
VITE_API_BASE_URL=https://your-cloud-run-service.run.app
DATABASE_URL=postgresql://user:password@host/database
NEON_DATA_API_URL=https://your-project.apirest.example/neondb/rest/v1
CRON_SECRET=replace-with-a-long-random-secret
APP_PUBLIC_URL=https://leapfrog7.github.io/secretariat-workflow-manager/
OPENAI_API_KEY=
GEMINI_API_KEY=
RESEND_API_KEY=
REMINDER_FROM_EMAIL=
```

- `VITE_NEON_AUTH_URL` and `VITE_NEON_DATA_API_URL` are public browser configuration values.
- `VITE_API_BASE_URL` is the public protected-API origin, currently Google Cloud Run.
- `DATABASE_URL` is privileged server-side configuration. Never commit it or expose it through a `VITE_` variable.
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `CRON_SECRET` and `RESEND_API_KEY` remain server-side. Never prefix provider keys with `VITE_`.
- If the two `VITE_NEON_*` URLs are absent or invalid, the application starts in local mode without account or workspace controls.

Start the development server:

```powershell
npm run dev
```

This always starts the Vite application, normally at `http://127.0.0.1:5173`.
The launcher reads the development environment before deciding whether the
protected local API is also needed:

- A hosted `VITE_API_BASE_URL` starts only Vite and uses that hosted API.
- A blank or localhost `VITE_API_BASE_URL` also starts the protected API.
- An already-running healthy SWM API is reused instead of failing on port 3000.

The API process reads server-only credentials from `.env.local` and `.env.vercel.local`. Vite also proxies `/lmstudio` to `http://127.0.0.1:1234`.

To force the protected API while testing it locally:

```powershell
npm run dev -- --local-api
```

To run only one side while debugging:

```powershell
npm run dev:web
npm run api:dev
```

### Development Cloud AI route

`VITE_API_BASE_URL` decides where the browser sends Cloud AI requests:

- Use the configured Cloud Run `VITE_API_BASE_URL` to run the React frontend locally against the deployed protected API. In this mode, `npm run dev` starts only Vite.
- Use `http://127.0.0.1:3000` only when intentionally testing the API functions locally with real server-side `GEMINI_API_KEY`, `NEON_DATA_API_URL` and `DATABASE_URL` values. Start both processes with `npm run dev`.

Values shown as `[SENSITIVE]` in a downloaded Vercel environment file are redacted placeholders and cannot be used by the local API process.

## Database Setup

The ordered SQL migrations live in `db/migrations`. The migration runner records applied files in `public.swm_migrations`, serializes concurrent runners with an advisory lock, and applies each migration transactionally.

```powershell
npm run db:migrate
npm run db:verify
```

The migrations create:

- `profiles`
- `workspaces`
- `workspace_members`
- `audit_events`
- `cloud_issues`
- `cloud_officers`
- supporting PostgreSQL functions, indexes and row-level security policies

## Background Automation

`vercel.json` schedules `api/cron/daily.js` once per day. The function uses India dates, claims one durable run per date, reactivates due scheduled Issues, records a milestone and creates deduplicated notifications for active workspace members.

Configure `DATABASE_URL`, `CRON_SECRET` and `APP_PUBLIC_URL` as Vercel production environment variables. Email remains optional; add `RESEND_API_KEY` and a verified `REMINDER_FROM_EMAIL` only when email delivery is required. Without those two values, the in-app inbox continues to work and email requests remain visibly unconfigured in the database.

### Bootstrap the first administrator

1. Register the account through the application.
2. Activate it as the first platform administrator:

```powershell
npm run admin:bootstrap -- officer@example.gov.in
```

This also creates or reuses the default `Secretariat Workspace` and grants the account Workspace Administrator membership.

### Trust an application origin

Neon Auth rejects untrusted browser origins. Add each exact origin without a trailing slash:

```powershell
npm run auth:trust-origin -- http://localhost:5173
npm run auth:trust-origin -- https://leapfrog7.github.io
```

Trusting the GitHub Pages origin does not include the repository path because an origin consists only of the scheme, host and optional port.

## AI Drafting

Users choose **Local LLM** or **Cloud API** under **Settings > AI drafting**. A workspace administrator must enable OpenAI or Gemini first. Gemini users choose a task level instead of a raw model name: **Simple** uses Gemini 3.5 Flash-Lite with minimal reasoning, while **Moderate** (the default) and **Hard** use Gemini 3.6 Flash with medium or high reasoning. Supported fallback models are attempted automatically when Google retires a configured model. Every cloud draft and selected-paragraph regeneration displays a confirmation naming the provider and the official context that will leave the workspace.

Cloud calls run through `api/ai/generate.js`. The browser supplies its Neon Auth JWT; Neon atomically checks membership, provider policy, per-user overrides and limits before Vercel reads the server-side provider key. AI logs retain provider, model, operation, token counts, estimated cost and status, but not prompts, official context or generated text.

### Local AI with LM Studio

The hosted application can call LM Studio on the same laptop at `http://127.0.0.1:1234`.

1. Install LM Studio and load an instruct model.
2. Start its server with browser access enabled:

```powershell
lms server stop
lms server start --cors
```

3. Open **Settings > AI drafting** and choose **Local LLM**.
4. Confirm the server address, test the connection and select a loaded model.
5. Allow localhost or local-network access if the browser requests permission.

Only the sources selected in the Drafting workspace are sent to LM Studio. They remain on that laptop unless LM Studio itself has been configured to expose the server elsewhere. Stop the server when it is not needed and do not bind it to a wider network without authentication.

### Paragraph Bank

Open an Issue, enter **Drafting**, and use the editor's **Bank** rail. Paragraphs can be
searched by name, wording, category or tag and filtered for the selected
communication type. Inserted wording is placed at the current draft cursor (or
replaces the selected text), after which the draft must be reviewed and saved
as a new version.

While a working draft is open, use **Draft tools > Details** beside the document
on desktop or through the floating **Draft tools** button on mobile. Communication
number, date, subject, addressee, salutation, copy list, communication type and
authorised signatory remain editable throughout drafting. These values are
protected from AI, but they are not locked from the user; updates are reflected
immediately in the page and its Word export.

### Draft versions

A generated draft is a temporary working copy. **Save** updates its current
saved copy. Use **Save as separate version** only when wording is worth
preserving independently; editing a preserved version creates a new mutable
copy rather than changing that record. Only the five newest draft records are
retained for each Issue. **Record outgoing** automatically preserves the exact
issued version before linking it to the communication chronology.

Personal paragraphs are available only to their creator. Shared paragraphs are
readable throughout the workspace and can be published or managed only by a
workspace administrator. Place variable details in square brackets, such as
`[DATE]`, `[ORGANIZATION]` or `[FILE NO.]`, so the draft visibly signals what
must be replaced before issue.

### Protected AI drafting

Local LM Studio, Gemini and future providers use the same drafting workflow.
The provider returns substantive prose only; the application constructs the
official heading, subject, addressee, close, signature and copy blocks from its
templates and saved office profile.

Regenerate selection works only inside the substantive body. Selecting a
subject, addressee or signature is rejected before a request is sent. Once the
complete draft has been freely edited as plain text, body-only regeneration is
disabled for that version so the application cannot silently overwrite manual
changes.

For cloud drafting, deploy the Vercel functions, apply migration `008_cloud_ai.sql`, add a server-only provider key, and enable that provider from Administration. Cloud report refinement additionally requires migrations `017_cloud_ai_report_operation.sql` and `018_report_permission_hardening.sql`. Enter current provider token rates there when estimated-cost tracking is required.

## Backup and Recovery

Open **Settings > Data and backup** to:

- download a JSON backup;
- save through the browser file picker where supported;
- restore a previous JSON backup;
- request persistent browser storage; and
- load or remove demonstration data.

Import replaces the current local database. The hosted application and `localhost` are separate browser origins and therefore have separate IndexedDB databases.

## Production Build and Deployment

```powershell
npm ci
npm run build
```

The production output is written to `dist`.

The protected API has a portable Cloud Run entry point in
`server/cloudRun.js`. Vercel may be retained temporarily as a rollback while
Cloud Run is verified. See
[`CLOUD_RUN_DEPLOYMENT.md`](CLOUD_RUN_DEPLOYMENT.md) for the account setup,
secrets, testing and rollback sequence.

Pushes to `main` run `.github/workflows/deploy-pages.yml`. The workflow installs dependencies, builds the application and deploys `dist` to GitHub Pages. Configure these GitHub repository variables under **Settings > Secrets and variables > Actions > Variables**:

- `VITE_NEON_AUTH_URL`
- `VITE_NEON_DATA_API_URL`
- `VITE_API_BASE_URL`

Before publishing, the workflow calls the protected API readiness endpoint and
checks that its required Neon migration is present. Apply migrations and deploy
Cloud Run before publishing a frontend that advances this release contract.

Do not add `DATABASE_URL` to the frontend build environment. Database migrations and bootstrap commands are administrative operations and should run only from a trusted local or protected CI environment.

## Project Structure

```text
db/migrations/             Neon/PostgreSQL schema and access policies
scripts/                   Migration, verification, origin and admin tools
src/components/auth/       Sign-in and access gates
src/components/issues/     Issue workspace, history, records and AI context
src/db/                    Dexie schema and local repositories
src/features/auth/         Neon Auth and account integration
src/features/cloud/        Issue and officer cloud reconciliation
src/pages/                 Register, Issue, Reports, Settings, Help and Administration pages
src/services/              LM Studio client and drafting requests
```

## Current Limitations and Next Work

- Vercel Hobby runs the scheduler daily, so reminders are date-based rather than minute-precise.
- Reminder recipients are active workspace members; the officer directory is not yet mapped to individual user accounts.
- Email delivery requires separate Resend configuration and a verified sending domain.
- Cloud AI must be deployed on Vercel and configured with at least one server-side provider key before it becomes available to users.
- Generated drafts have saved versions and native Word `.docx` export, but formal approval states are not implemented yet.
- Reports provide operational snapshots, period-based activity and optional Local LLM or Cloud API refinement. Scheduled and governed distribution remains planned.
- Workspace creation and delegated Workspace Administrator controls are not fully exposed in the UI.
- Operational Issue changes do not yet have a complete actor-attributed cloud audit trail.
- Automated test coverage and production monitoring still need to be added.

See the in-application **How to use** page for user-facing instructions and the current cloud/local data boundary.

## Privacy and Security

- Do not commit `.env.local`, database credentials or provider API keys.
- Do not assume IndexedDB is a permanent backup.
- Avoid storing classified or restricted information unless the deployment has been approved for that data.
- Use fictional or approved data for demonstrations.
- Keep row-level security enabled and verify policies after schema changes.
- Treat every AI-generated draft as unverified until reviewed and approved by the responsible officer.
