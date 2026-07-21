# Secretariat Workflow Manager

A local-first React application for managing government-secretariat Issues, allocation, milestones, communications, references, eReceipts, recurring work and CSMOP-structured drafting.

**Live application:** https://leapfrog7.github.io/secretariat-workflow-manager/

## Core Design

- Issue data is stored in the user's browser through IndexedDB.
- JSON export and restore provide user-controlled backup.
- No application database or uploaded PDF storage is required.
- Optional AI drafting uses an LM Studio server running on the same laptop.
- Government communication structure is assembled programmatically; the local model drafts only the body.

## Hosted Application and Local AI

The GitHub Pages application can connect to LM Studio on the visitor's own computer at `http://127.0.0.1:1234`.

1. Install LM Studio and download/load a local instruct model.
2. Start the server with browser access enabled:

```powershell
lms server start --cors
```

3. Open **Settings → Local AI** in the application.
4. Confirm the server is `http://127.0.0.1:1234`, select the model and test the connection.
5. Allow localhost/local-network access if the browser requests permission.

Each browser talks only to LM Studio on that same laptop. The GitHub Pages server does not receive prompts or model responses. Enabling CORS exposes the local API to browser origins, so stop the LM Studio server when it is not needed and do not bind it to the local network without authentication.

## Local Development

Requirements: Node.js 22 or newer, npm and a modern browser.

```powershell
npm install
npm run dev
```

Local development uses Vite's `/lmstudio` proxy, so LM Studio can run with its default localhost configuration.

## Production Build

```powershell
npm ci
npm run build
```

The production output is written to `dist`. Pushes to `main` deploy the site through `.github/workflows/deploy-pages.yml` after GitHub Pages is enabled with **GitHub Actions** as its source.

## Privacy and Limitations

- There is no login, cloud sync or multi-user database.
- Data is scoped to the browser and site origin and can be removed when browser storage is cleared.
- Export JSON backups regularly.
- Generated drafts require human review and approval.
- Use fictional data for demonstrations and follow the applicable departmental security policy for official information.
