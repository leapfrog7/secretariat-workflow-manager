import { REQUIRED_DATABASE_MIGRATION } from '../shared/releaseContract.js';

const origin = String(process.env.API_BASE_URL || '').trim().replace(/\/$/, '');
if (!origin) throw new Error('API_BASE_URL is required for release verification.');

let response = await fetch(`${origin}/api/readiness`, {
  headers: { 'User-Agent': 'Secretariat-Workflow-Manager-Release-Check/1.0' },
});
let payload = await response.json().catch(() => ({}));
let legacyReady = false;
if (response.status === 404 && process.env.ALLOW_LEGACY_API_HEALTH === 'true') {
  response = await fetch(`${origin}/api/health`, {
    headers: { 'User-Agent': 'Secretariat-Workflow-Manager-Release-Check/1.0' },
  });
  payload = await response.json().catch(() => ({}));
  if (response.ok && payload.status === 'ok') {
    console.warn(`Legacy API health verified at ${origin}. Deploy /api/readiness before the next frontend release.`);
    legacyReady = true;
  }
}
if (!legacyReady && (!response.ok || payload.status !== 'ready')) {
  throw new Error(`Protected API is not ready (${payload.code || response.status}). Deploy the API and apply ${REQUIRED_DATABASE_MIGRATION} before publishing the frontend.`);
}
if (!legacyReady && payload.requiredMigration !== REQUIRED_DATABASE_MIGRATION) {
  throw new Error(`Protected API reports an unexpected database contract: ${payload.requiredMigration || 'unknown'}.`);
}
if (!legacyReady) console.log(`Release contract verified at ${origin}: ${REQUIRED_DATABASE_MIGRATION}`);
