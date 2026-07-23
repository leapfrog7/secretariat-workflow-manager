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
- Register multiple eReceipts and source documents without uploading PDF files.
- Capture references such as Office Memoranda, rules, instructions and court directions.
- Preview and select the exact Issue context made available for drafting.

### Official drafting

- Configure the Ministry or Department, office details, house style and authorised signatories.
- Prepare Office Memoranda, D.O. Letters, Letters, Office Orders, Orders, I.D. Notes and related forms.
- Assemble the official document structure programmatically and ask the model to draft the body.
- Generate through LM Studio on the user's laptop or an administrator-approved OpenAI/Gemini API.
- Edit and copy a generated draft without saving it automatically.
- Optionally retain up to five rolling draft versions per Issue, including communication type and signatory metadata.
- Export editable Word-compatible RTF files, regenerate a selected passage and convert a saved draft into a linked outgoing communication record.

Generated text is a drafting aid. The responsible officer must verify facts, citations, authority, classification, tone and approvals before issuing a communication.

### Accounts and administration

- Register and sign in through Neon Auth.
- Hold new registrations for administrator approval.
- Require both an active account and active workspace membership.
- Approve, suspend and restore users from the Administration page.
- Grant Officer or Workspace Administrator membership.
- Protect cloud tables with PostgreSQL row-level security policies.

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
| Local AI and reminder settings | Neon user settings plus local cache |
| Notification inbox and automation run history | Neon |
| Uploaded PDFs | Not stored |
| Generated drafts | Versioned Issue records in Neon plus local cache |

The cloud control in the application header reconciles the complete Issue workspace. IndexedDB remains the responsive local working copy, and JSON export remains available for recovery and portability.

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
VITE_API_BASE_URL=https://your-vercel-project.vercel.app
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
- `VITE_API_BASE_URL` is the public Vercel origin when the React site is hosted elsewhere.
- `DATABASE_URL` is privileged server-side configuration. Never commit it or expose it through a `VITE_` variable.
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `CRON_SECRET` and `RESEND_API_KEY` remain server-side. Never prefix provider keys with `VITE_`.
- If the two `VITE_NEON_*` URLs are absent or invalid, the application starts in local mode without account or workspace controls.

Start the development server:

```powershell
npm run dev
```

Vite serves the application locally and proxies `/lmstudio` to `http://127.0.0.1:1234`.

## Database Setup

The ordered SQL migrations live in `db/migrations`. The migration runner records applied files in `public.swm_migrations` and skips them on later runs.

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

Users choose **Local LLM** or **Cloud API** under **Settings > AI drafting**. A workspace administrator must enable OpenAI or Gemini first. Gemini users choose a task level instead of a raw model name: **Simple** routes to Gemini 2.5 Flash-Lite, **Moderate** (the default) routes to Gemini 2.5 Flash, and **Hard** routes to Gemini 2.5 Pro. Every cloud draft and selected-paragraph regeneration displays a confirmation naming the provider and the official context that will leave the workspace.

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

Only the context selected in the AI Context workspace is sent to LM Studio. It remains on that laptop unless LM Studio itself has been configured to expose the server elsewhere. Stop the server when it is not needed and do not bind it to a wider network without authentication.

For cloud drafting, deploy the Vercel functions, apply migration `008_cloud_ai.sql`, add a server-only provider key, and enable that provider from Administration. Enter current provider token rates there when estimated-cost tracking is required.

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

Pushes to `main` run `.github/workflows/deploy-pages.yml`. The workflow installs dependencies, builds the application and deploys `dist` to GitHub Pages. Configure these GitHub repository variables under **Settings > Secrets and variables > Actions > Variables**:

- `VITE_NEON_AUTH_URL`
- `VITE_NEON_DATA_API_URL`

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
src/pages/                 Register, Issue, Settings, Help and Administration pages
src/services/              LM Studio client and drafting requests
```

## Current Limitations and Next Work

- Vercel Hobby runs the scheduler daily, so reminders are date-based rather than minute-precise.
- Reminder recipients are active workspace members; the officer directory is not yet mapped to individual user accounts.
- Email delivery requires separate Resend configuration and a verified sending domain.
- Cloud AI must be deployed on Vercel and configured with at least one server-side provider key before it becomes available to users.
- Generated drafts have saved versions, but approval states and document export are not implemented yet.
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
