import { DEFAULT_LOCAL_AI_SETTINGS } from '../constants/issueConstants';
import { buildGovernmentDraftPrompt, COMMUNICATION_TYPES, constrainConservativeBody, formatGovernmentCommunication } from '../utils/governmentDraftUtils';

export { COMMUNICATION_TYPES };

export function normalizeLocalAISettings(input = {}) {
  return {
    baseUrl: String(input.baseUrl || DEFAULT_LOCAL_AI_SETTINGS.baseUrl).trim().replace(/\/$/, ''),
    model: String(input.model || DEFAULT_LOCAL_AI_SETTINGS.model).trim(),
  };
}

function requireLocalBaseUrl(value) {
  const baseUrl = String(value || '').trim().replace(/\/$/, '');
  if (baseUrl.startsWith('/')) return baseUrl;
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('Enter a valid LM Studio server address.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('For this proof of concept, the AI server must run on this computer.');
  }
  return baseUrl;
}

async function request(baseUrl, path, options = {}) {
  const localBaseUrl = requireLocalBaseUrl(baseUrl);
  const isHostedLoopbackRequest = typeof window !== 'undefined'
    && window.location.protocol === 'https:'
    && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(localBaseUrl);
  let response;
  try {
    response = await fetch(`${localBaseUrl}${path}`, {
      ...options,
      ...(isHostedLoopbackRequest ? { targetAddressSpace: 'loopback' } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach LM Studio. Confirm that its local server is running.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : payload.error?.message || payload.message;
    throw new Error(message || `LM Studio request failed (${response.status}).`);
  }
  return payload;
}

export async function listLMStudioModels(settings, { signal } = {}) {
  const config = normalizeLocalAISettings(settings);
  const payload = await request(config.baseUrl, '/api/v1/models', { method: 'GET', signal });
  return (payload.models || [])
    .filter((model) => model.type === 'llm')
    .map((model) => ({
      id: model.key,
      name: model.display_name || model.key,
      params: model.params_string || '',
      loaded: Boolean(model.loaded_instances?.length),
      contextLength: model.max_context_length || null,
    }));
}

export async function generateLocalDraft({ settings, context, communicationType, officeProfile, signatory, recipient, recipientRelationship, draftMode = 'conservative', documentDetails = {}, instruction, signal }) {
  const config = normalizeLocalAISettings(settings);
  if (!config.model) throw new Error('Select a local model in Settings.');
  if (!context?.trim()) throw new Error('The AI context is empty.');
  if (!signatory?.name) throw new Error('Select an authorized signatory before generating the draft.');
  const input = buildGovernmentDraftPrompt({ communicationType, officeProfile, signatory, recipient, recipientRelationship, draftMode, context, instruction });
  const payload = await request(config.baseUrl, '/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: config.model,
      system_prompt: 'Draft only the substantive body of an outgoing Government of India official communication for human review. The configured Ministry or Department is the sender and the named organization is the recipient; never reverse them. Every factual phrase must come from the supplied input. Prefer omission over elaboration, use the fewest necessary sentences, and state each request once. Never invent or infer facts, dates, recipients, rules, authorities, decisions, approvals, rationale, protocols, enclosures, availability, report contents, contact instructions, urgency, or distribution lists. Preserve eReceipt numbers and citations exactly. Output body paragraphs only. Do not output headings, labels, subject, salutation, close, signature, recipient, Markdown, preface, explanation, or drafting commentary.',
      input,
      temperature: 0.1,
      stream: false,
      store: false,
    }),
  });
  const body = (payload.output || [])
    .filter((item) => item.type === 'message' && item.content)
    .map((item) => item.content)
    .join('\n\n')
    .trim();
  if (!body) throw new Error('LM Studio returned no draft text.');
  return {
    text: formatGovernmentCommunication({ communicationType, officeProfile, signatory, recipient, ...documentDetails, body: draftMode === 'conservative' ? constrainConservativeBody(body) : body }),
    model: payload.model_instance_id || config.model,
    stats: payload.stats || {},
  };
}
