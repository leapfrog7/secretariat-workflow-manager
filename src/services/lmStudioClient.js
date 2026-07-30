import { DEFAULT_LOCAL_AI_SETTINGS } from '../constants/issueConstants.js';
import { COMMUNICATION_TYPES } from '../utils/governmentDraftUtils.js';
import { buildReportRefinementInput, normalizeReportRefinement, REPORT_REFINEMENT_SYSTEM_PROMPT } from '../utils/reportAIUtils.js';

export { COMMUNICATION_TYPES };
export const RUNNING_SUMMARY_SYSTEM_PROMPT = 'Convert the supplied official notes into a concise factual running summary for Government work. Preserve material dates, names, file or eReceipt numbers, decisions, directions, rule citations, deadlines, pending actions and responsibility. Remove repetition, drafting discussion and non-material detail. Never invent facts or resolve uncertainty. Use short paragraphs, bullets and Markdown tables only where a table makes dates, responsibilities or status clearer. Return only the summary in Markdown.';

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
  const {
    timeoutMs = 120000,
    signal: externalSignal,
    ...fetchOptions
  } = options;
  const isHostedLoopbackRequest = typeof window !== 'undefined'
    && window.location.protocol === 'https:'
    && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(localBaseUrl);
  const controller = new AbortController();
  let timedOut = false;
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  let response;
  let responseText = '';
  try {
    response = await fetch(`${localBaseUrl}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      ...(isHostedLoopbackRequest ? { targetAddressSpace: 'loopback' } : {}),
    });
    responseText = await response.text();
  } catch (error) {
    if (timedOut) {
      throw new Error('LM Studio did not respond in time. Unload and reload the selected model, then test it again in Settings.');
    }
    if (externalSignal?.aborted || error.name === 'AbortError') throw error;
    if (isHostedLoopbackRequest) {
      throw new Error('Cannot reach LM Studio from the hosted app. Restart it with "lms server start --cors", then allow localhost access if your browser asks.');
    }
    throw new Error('Cannot reach LM Studio. Confirm that its local server is running.');
  } finally {
    globalThis.clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : payload.error?.message || payload.message;
    if (message) throw new Error(message);
    if (response.status >= 500) {
      throw new Error(`LM Studio could not run the selected model (${response.status}). Unload and reload that model, then use Test connection in Settings.`);
    }
    throw new Error(responseText || `LM Studio request failed (${response.status}).`);
  }
  return payload;
}

export async function listLMStudioModels(settings, { signal } = {}) {
  const config = normalizeLocalAISettings(settings);
  const payload = await request(config.baseUrl, '/api/v1/models', {
    method: 'GET',
    signal,
    timeoutMs: 15000,
  });
  return (payload.models || [])
    .filter((model) => model.type === 'llm')
    .map((model) => ({
      id: model.key,
      name: model.display_name || model.key,
      params: model.params_string || '',
      loaded: Boolean(model.loaded_instances?.length),
      contextLength: model.max_context_length || null,
      loadedContextLength: model.loaded_instances?.[0]?.config?.context_length || null,
      reasoningOptions: model.capabilities?.reasoning?.allowed_options || [],
    }));
}

async function resolveLoadedModel(config, { signal } = {}) {
  const models = await listLMStudioModels(config, { signal });
  if (!models.length) throw new Error('LM Studio did not report any language models.');
  const loadedModels = models.filter((model) => model.loaded);
  const selected = models.find((model) => model.id === config.model);
  if (selected?.loaded) return { model: selected, models };
  if (loadedModels.length === 1) return { model: loadedModels[0], models };
  if (!loadedModels.length) {
    throw new Error('No language model is loaded in LM Studio. Load one, then use Test connection in Settings.');
  }
  if (selected) {
    throw new Error(`${selected.name} is downloaded but not loaded. Load it in LM Studio or select another loaded model.`);
  }
  throw new Error('The saved model is no longer selected. Choose one of the loaded models in Settings.');
}

export function estimateLocalPromptTokens(systemPrompt, input) {
  const characters = String(systemPrompt || '').length + String(input || '').length;
  return Math.ceil(characters / 3);
}

function assertPromptFitsModel(model, systemPrompt, input, maxOutputTokens) {
  const contextLength = model.loadedContextLength || model.contextLength;
  if (!contextLength) return;
  const estimatedInputTokens = estimateLocalPromptTokens(systemPrompt, input);
  const reservedTokens = maxOutputTokens + 512;
  if (estimatedInputTokens + reservedTokens <= contextLength) return;
  const availableInputTokens = Math.max(0, contextLength - reservedTokens);
  throw new Error(
    `The selected AI context is too large for ${model.name}'s ${contextLength.toLocaleString()}-token loaded context `
    + `(about ${estimatedInputTokens.toLocaleString()} input tokens; ${availableInputTokens.toLocaleString()} available). `
    + 'Deselect unnecessary communications or references, shorten the running summary, or turn off selected Issue context before trying again.',
  );
}

async function requestLocalChat({
  settings,
  systemPrompt,
  input,
  maxOutputTokens,
  timeoutMs = 180000,
  signal,
}) {
  const config = normalizeLocalAISettings(settings);
  if (!config.model) throw new Error('Select a local model in Settings.');
  const resolved = await resolveLoadedModel(config, { signal });
  assertPromptFitsModel(resolved.model, systemPrompt, input, maxOutputTokens);
  const payload = await request(config.baseUrl, '/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    timeoutMs,
    body: JSON.stringify({
      model: resolved.model.id,
      system_prompt: systemPrompt,
      input,
      temperature: 0.1,
      max_output_tokens: maxOutputTokens,
      ...(resolved.model.reasoningOptions.includes('off') ? { reasoning: 'off' } : {}),
      stream: false,
      store: false,
    }),
  });
  return { payload, ...resolved };
}

export async function testLMStudioModel(settings, { signal } = {}) {
  const result = await requestLocalChat({
    settings,
    systemPrompt: 'Follow the instruction exactly.',
    input: 'Reply with only: READY',
    maxOutputTokens: 8,
    timeoutMs: 60000,
    signal,
  });
  const text = (result.payload.output || [])
    .filter((item) => item.type === 'message' && item.content)
    .map((item) => item.content)
    .join('\n')
    .trim();
  if (!text) throw new Error('The loaded model connected but returned no test response.');
  return {
    models: result.models,
    model: result.model,
    response: text,
  };
}

export async function summarizeLocalNotes({ settings, notes, issueTitle, signal }) {
  if (!notes?.trim()) throw new Error('Add notes before asking AI to summarize them.');
  const { payload, model } = await requestLocalChat({
    settings,
    systemPrompt: RUNNING_SUMMARY_SYSTEM_PROMPT,
    input: `ISSUE\n${issueTitle || 'Not specified'}\n\nSOURCE NOTES\n${notes}`,
    maxOutputTokens: 1400,
    signal,
  });
  const text = (payload.output || [])
    .filter((item) => item.type === 'message' && item.content)
    .map((item) => item.content)
    .join('\n\n')
    .replace(/```(?:markdown|md)?/gi, '')
    .trim();
  if (!text) throw new Error('LM Studio returned no summary text.');
  return { text, model: payload.model_instance_id || model.id, stats: payload.stats || {} };
}

export async function requestLocalDraftAI({ settings, operation = 'draft', instructions, input, signal }) {
  const { payload, model } = await requestLocalChat({
    settings,
    systemPrompt: instructions,
    input,
    maxOutputTokens: operation === 'paragraph' ? 700 : 1000,
    signal,
  });
  const text = (payload.output || [])
    .filter((item) => item.type === 'message' && item.content)
    .map((item) => item.content)
    .join('\n\n')
    .trim();
  if (!text) throw new Error('LM Studio returned no draft text.');
  return {
    text,
    model: payload.model_instance_id || model.id,
    stats: payload.stats || {},
  };
}

export async function refineLocalReport({ settings, report, signal }) {
  const input = buildReportRefinementInput(report);
  const { payload, model } = await requestLocalChat({
    settings,
    systemPrompt: REPORT_REFINEMENT_SYSTEM_PROMPT,
    input,
    maxOutputTokens: 3000,
    signal,
  });
  const rawText = (payload.output || [])
    .filter((item) => item.type === 'message' && item.content)
    .map((item) => item.content)
    .join('\n\n');
  return {
    ...normalizeReportRefinement(rawText, report),
    model: payload.model_instance_id || model.id,
    stats: payload.stats || {},
  };
}
