import { cloudClient } from '../features/auth/cloudClient';
import { buildRunningSummarySystemPrompt } from '../utils/runningSummaryAI';
import { buildReportRefinementInput, normalizeReportRefinement, REPORT_REFINEMENT_SYSTEM_PROMPT } from '../utils/reportAIUtils';
import { resolveCloudAIBaseUrl } from '../utils/cloudAIUrl';

function apiUrl(path) {
  const base = resolveCloudAIBaseUrl(import.meta.env.VITE_API_BASE_URL);
  return `${base}${path}`;
}

function localApiBase() {
  const base = resolveCloudAIBaseUrl(import.meta.env.VITE_API_BASE_URL);
  return /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(base) ? base : '';
}

async function authToken() {
  if (!cloudClient) throw new Error('Sign in to use Cloud AI.');
  const sessionResult = await cloudClient.auth.getSession({ query: { disableCookieCache: true } });
  const sessionToken = sessionResult?.data?.session?.token;
  if (sessionToken && sessionToken.split('.').length === 3) return sessionToken;

  const tokenResult = await cloudClient.auth.token();
  const token = tokenResult?.data?.token;
  if (token) return token;
  throw new Error(sessionResult?.error?.message || tokenResult?.error?.message || 'Your cloud session has expired. Sign in again.');
}

async function cloudRequest(path, options = {}) {
  const token = await authToken();
  let response;
  try {
    response = await fetch(apiUrl(path), {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    const localBase = localApiBase();
    if (localBase) {
      throw new Error(`Cannot reach the local Cloud AI API at ${localBase}. Restart development with "npm run dev".`);
    }
    throw new Error('Cannot reach the Cloud AI service on Google Cloud Run. Check the network connection and try again.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Cloud AI request failed (${response.status}).`);
  return payload;
}

export async function getCloudAIStatus(workspaceId, { signal } = {}) {
  if (!workspaceId) return { providers: [] };
  return cloudRequest(`/api/ai/status?workspaceId=${encodeURIComponent(workspaceId)}`, { method: 'GET', signal });
}

async function generate({ workspaceId, issueId, issueIds, provider, taskLevel, operation, instructions, input, signal }) {
  return cloudRequest('/api/ai/generate', {
    method: 'POST',
    signal,
    body: JSON.stringify({ workspaceId, issueId, issueIds, provider, taskLevel, operation, instructions, input }),
  });
}

export async function summarizeCloudNotes({ workspaceId, issueId, provider, taskLevel, notes, issueTitle, detail = 'standard', signal }) {
  if (!workspaceId) throw new Error('An active cloud workspace is required.');
  if (!notes?.trim()) throw new Error('Add notes before asking AI to summarize them.');
  const input = `ISSUE\n${issueTitle || 'Not specified'}\n\nSOURCE NOTES\n${notes}`;
  // Summary generation uses the existing draft authorization bucket until AI log
  // operations can be migrated without interrupting deployed workspaces.
  const payload = await generate({ workspaceId, issueId, provider, taskLevel, operation: 'draft', instructions: buildRunningSummarySystemPrompt(detail), input, signal });
  const text = String(payload.text || '').replace(/```(?:markdown|md)?/gi, '').trim();
  if (!text) throw new Error('Cloud AI returned no summary text.');
  return { text, model: `${payload.provider}: ${payload.model}`, stats: payload.usage || {} };
}

export async function requestCloudDraftAI({
  workspaceId,
  issueId,
  provider,
  taskLevel,
  operation,
  instructions,
  input,
  maxOutputTokens,
  signal,
}) {
  if (!workspaceId) throw new Error('An active cloud workspace is required.');
  const payload = await generate({
    workspaceId,
    issueId,
    provider,
    taskLevel,
    operation,
    instructions,
    input,
    signal,
  });
  const text = String(payload.text || '').trim();
  if (!text) throw new Error('Cloud AI returned no draft text.');
  return {
    text,
    model: `${payload.provider}: ${payload.model}`,
    stats: payload.usage || {},
  };
}

export async function refineCloudReport({ workspaceId, provider, taskLevel, report, signal }) {
  if (!workspaceId) throw new Error('An active cloud workspace is required.');
  const input = buildReportRefinementInput(report);
  const payload = await generate({
    workspaceId,
    issueId: null,
    issueIds: (report.kind === 'activity' ? report.issues : report.rows).map((issue) => issue.id),
    provider,
    taskLevel,
    operation: 'report',
    instructions: REPORT_REFINEMENT_SYSTEM_PROMPT,
    input,
    signal,
  });
  return {
    ...normalizeReportRefinement(payload.text, report),
    model: `${payload.provider}: ${payload.model}`,
    stats: payload.usage || {},
  };
}
