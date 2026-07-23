import { cloudClient } from '../features/auth/cloudClient';
import { buildGovernmentDraftPrompt, constrainConservativeBody, formatGovernmentCommunication } from '../utils/governmentDraftUtils';
import { GOVERNMENT_DRAFT_SYSTEM_PROMPT, PARAGRAPH_REWRITE_SYSTEM_PROMPT } from './lmStudioClient';

function apiUrl(path) {
  const base = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  return `${base}${path}`;
}

function localApiBase() {
  const base = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
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
    throw new Error('Cannot reach the Cloud AI service. Confirm that the Vercel API is deployed.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Cloud AI request failed (${response.status}).`);
  return payload;
}

export async function getCloudAIStatus(workspaceId, { signal } = {}) {
  if (!workspaceId) return { providers: [] };
  return cloudRequest(`/api/ai/status?workspaceId=${encodeURIComponent(workspaceId)}`, { method: 'GET', signal });
}

async function generate({ workspaceId, issueId, provider, taskLevel, operation, instructions, input, signal }) {
  return cloudRequest('/api/ai/generate', {
    method: 'POST',
    signal,
    body: JSON.stringify({ workspaceId, issueId, provider, taskLevel, operation, instructions, input }),
  });
}

export async function generateCloudDraft({ workspaceId, issueId, provider, taskLevel, context, communicationType, officeProfile, signatory, recipient, recipientRelationship, draftMode = 'conservative', documentDetails = {}, instruction, signal }) {
  if (!workspaceId) throw new Error('An active cloud workspace is required.');
  const input = buildGovernmentDraftPrompt({ communicationType, officeProfile, signatory, recipient, recipientRelationship, draftMode, context, instruction });
  const payload = await generate({ workspaceId, issueId, provider, taskLevel, operation: 'draft', instructions: GOVERNMENT_DRAFT_SYSTEM_PROMPT, input, signal });
  const body = String(payload.text || '').trim();
  if (!body) throw new Error('Cloud AI returned no draft text.');
  return {
    text: formatGovernmentCommunication({ communicationType, officeProfile, signatory, recipient, ...documentDetails, body: draftMode === 'conservative' ? constrainConservativeBody(body) : body }),
    model: `${payload.provider}: ${payload.model}`,
    stats: payload.usage || {},
  };
}

export async function regenerateCloudParagraph({ workspaceId, issueId, provider, taskLevel, fullDraft, selectedText, context, communicationType, instruction, signal }) {
  if (!workspaceId) throw new Error('An active cloud workspace is required.');
  const input = [
    `COMMUNICATION TYPE\n${communicationType}`,
    `ORIGINAL DRAFT FOR CONTEXT\n${fullDraft}`,
    `SELECTED PASSAGE TO REWRITE\n${selectedText}`,
    `ORIGINAL DRAFTING BRIEF\n${instruction || 'No additional brief.'}`,
    `RELEVANT ISSUE CONTEXT\n${context || 'No additional context supplied.'}`,
  ].join('\n\n');
  const payload = await generate({ workspaceId, issueId, provider, taskLevel, operation: 'paragraph', instructions: PARAGRAPH_REWRITE_SYSTEM_PROMPT, input, signal });
  const text = String(payload.text || '').replace(/```(?:text)?/gi, '').trim();
  if (!text) throw new Error('Cloud AI returned no replacement paragraph.');
  return { text, model: `${payload.provider}: ${payload.model}`, stats: payload.usage || {} };
}
