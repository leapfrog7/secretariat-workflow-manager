# Cloud Run Backend Migration

## Objective

Move the protected API from the blocked `vercel.app` origin to a Google Cloud
Run `run.app` origin. GitHub Pages remains the frontend and Neon remains the
authority for authentication, permissions, Issue access, AI policy and usage
logging.

```text
GitHub Pages
    |
    +-- Neon Auth and Data API
    |
    +-- Cloud Run API
            |
            +-- Neon authorization and usage logging
            +-- Gemini or OpenAI
```

The Vercel deployment remains available as a rollback until Cloud Run has
passed office-network and mobile-network testing.

## Delivery Phases

### Phase 1: Portable API

Implemented in the repository:

- `server/apiServer.js` routes the existing handlers without duplicating their
  authorization logic.
- `server/cloudRun.js` listens on Cloud Run's `PORT` and `0.0.0.0`.
- `scripts/local-api-server.js` uses the same server implementation.
- `/api/health` provides a public, content-free readiness response.
- JSON request bodies are limited to 2 MB.
- `.gcloudignore` excludes local credentials, build output and development
  files from source uploads.

### Phase 2: Google Cloud Foundation

Manual account work:

1. Create a dedicated Google Cloud project.
2. Link it to an active Cloud Billing account.
3. Configure a small billing budget and alerts.
4. Record the immutable project ID.
5. Use Google Cloud Shell for setup so a local `gcloud` installation is not
   required.

Do not paste credentials or API keys into chat, source files or deployment
commands.

### Phase 3: Secrets and First Deployment

Required server-side secrets:

- `DATABASE_URL`
- `NEON_DATA_API_URL`
- `GEMINI_API_KEY`

Required non-secret configuration:

- `APP_PUBLIC_URL=https://leapfrog7.github.io/secretariat-workflow-manager/`
- `AI_ALLOWED_ORIGINS=https://leapfrog7.github.io`

Optional secrets remain:

- `OPENAI_API_KEY`
- `CRON_SECRET`
- `RESEND_API_KEY`
- `REMINDER_FROM_EMAIL`

The first revision will be deployed publicly because the browser must invoke
it. AI routes still require a valid Neon bearer token and enforce workspace and
Issue permissions before provider contact.

### Phase 4: Verification

Verify in this order:

1. `GET /api/health` returns `200`.
2. An unauthenticated AI status request returns `401`.
3. The signed-in application can read provider status.
4. Gemini generates a test draft using fictional content.
5. Neon records the generation status and token usage.
6. Repeat from the NIC office network and a mobile network.

### Phase 5: Frontend Cutover

Only after Phase 4 succeeds:

1. Set the GitHub Actions variable `VITE_API_BASE_URL` to the Cloud Run origin.
2. Rebuild and publish GitHub Pages.
3. Confirm drafting, note refinement and report refinement.
4. Keep the Vercel deployment unchanged during the rollback period.

### Phase 6: Scheduled Work

Migrate `/api/cron/daily` separately after AI traffic is stable. Cloud Scheduler
will invoke it on the existing daily schedule. Reminder migration must not
delay the AI connectivity fix.

## Cost and Safety

- Cloud Run scales to zero when idle.
- Gemini and Cloud Run usage should have separate billing alerts where
  available.
- Provider keys remain server-side.
- Official prompts and generated text are not stored in AI generation logs.
- The health endpoint exposes no credentials, database details or user data.
