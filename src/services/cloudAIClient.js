import { cloudClient } from '../features/auth/cloudClient';
import { buildGovernmentDraftPrompt, constrainConservativeBody, formatGovernmentCommunication } from '../utils/governmentDraftUtils';
import { GOVERNMENT_DRAFT_SYSTEM_PROMPT, PARAGRAPH_REWRITE_SYSTEM_PROMPT } from './lmStudioClient';

function apiUrl(path) {
  const base = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  return `${base}${path}`;
}

async function authToken() {
  if (!cloudClient) throw new Error('Sign in to use Cloud AI.');
  const result = await cloudClient.auth.token();
  const token = result?.data?.token;
  if (!token) throw new Error(result?.error?.message || 'Your cloud session has expired. Sign in again.');
  return token;
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

async function generate({ workspaceId, issueId, provider, operation, instructions, input, signal }) {
  return cloudRequest('/api/ai/generate', {
    method: 'POST',
    signal,
    body: JSON.stringify({ workspaceId, issueId, provider, operation, instructions, input }),
  });
}

export async function generateCloudDraft({ workspaceId, issueId, provider, context, communicationType, officeProfile, signatory, recipient, recipientRelationship, draftMode = 'conservative', documentDetails = {}, instruction, signal }) {
  if (!workspaceId) throw new Error('An active cloud workspace is required.');
  const input = buildGovernmentDraftPrompt({ communicationType, officeProfile, signatory, recipient, recipientRelationship, draftMode, context, instruction });
  const payload = await generate({ workspaceId, issueId, provider, operation: 'draft', instructions: GOVERNMENT_DRAFT_SYSTEM_PROMPT, input, signal });
  const body = String(payload.text || '').trim();
  if (!body) throw new Error('Cloud AI returned no draft text.');
  return {
    text: formatGovernmentCommunication({ communicationType, officeProfile, signatory, recipient, ...documentDetails, body: draftMode === 'conservative' ? constrainConservativeBody(body) : body }),
    model: `${payload.provider}: ${payload.model}`,
    stats: payload.usage || {},
  };
}

export async function regenerateCloudParagraph({ workspaceId, issueId, provider, fullDraft, selectedText, context, communicationType, instruction, signal }) {
  if (!workspaceId) throw new Error('An active cloud workspace is required.');
  const input = [
    `COMMUNICATION TYPE\n${communicationType}`,
    `ORIGINAL DRAFT FOR CONTEXT\n${fullDraft}`,
    `SELECTED PASSAGE TO REWRITE\n${selectedText}`,
    `ORIGINAL DRAFTING BRIEF\n${instruction || 'No additional brief.'}`,
    `RELEVANT ISSUE CONTEXT\n${context || 'No additional context supplied.'}`,
  ].join('\n\n');
  const payload = await generate({ workspaceId, issueId, provider, operation: 'paragraph', instructions: PARAGRAPH_REWRITE_SYSTEM_PROMPT, input, signal });
  const text = String(payload.text || '').replace(/```(?:text)?/gi, '').trim();
  if (!text) throw new Error('Cloud AI returned no replacement paragraph.');
  return { text, model: `${payload.provider}: ${payload.model}`, stats: payload.usage || {} };
}
