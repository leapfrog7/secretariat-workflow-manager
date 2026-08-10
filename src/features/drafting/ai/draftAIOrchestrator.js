import {
  createDraftDocument,
  normalizeDraftDocument,
  replaceDraftBodyBlocks,
  renderStructuredDraft,
} from '../domain/draftDocument.js';
import {
  buildGovernmentDraftPrompt,
  constrainConservativeBody,
  sanitizeGeneratedBody,
} from '../../../utils/governmentDraftUtils.js';
import {
  buildParagraphRewriteInput,
  draftContentGuidance,
  draftContentOutputTokens,
  GOVERNMENT_DRAFT_SYSTEM_PROMPT,
  PARAGRAPH_REWRITE_SYSTEM_PROMPT,
} from './draftAIPrompts.js';

export { renderStructuredDraft };

const MAX_BODY_CHARACTERS = 24000;
const FORBIDDEN_BODY_LINE = /^(?:to\s*:|office memorandum|office order|order|notification|resolution|endorsement|yours (?:faithfully|sincerely)|-?sd\/?-?|government of india)$/i;

function requireProvider(provider) {
  if (!provider || typeof provider.generateText !== 'function') {
    throw new Error('An AI drafting provider is required.');
  }
  return provider;
}

export function normalizeAITextResponse(value, { operation = 'draft' } = {}) {
  const raw = String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:text|markdown|md|json)?/gi, '')
    .replace(/^\s*(?:here is|below is|draft(?:ed)?(?: body)?\s*:).*\r?\n+/i, '')
    .trim();
  if (!raw) throw new Error('The AI provider returned no draft text.');
  if (/^[{[]/.test(raw)) throw new Error('The AI provider returned structured data instead of official prose.');
  if (raw.length > MAX_BODY_CHARACTERS) throw new Error('The AI response is too long to use safely as an official draft body.');

  const sanitized = sanitizeGeneratedBody(raw);
  if (!sanitized || sanitized === '[BODY]') throw new Error('The AI provider did not return a usable substantive body.');
  if (operation === 'paragraph' && sanitized.split(/\n\s*\n/).filter(Boolean).length > 4) {
    throw new Error('The replacement is too broad. Select a smaller passage and try again.');
  }
  const leakedLine = sanitized.split(/\r?\n/).find((line) => FORBIDDEN_BODY_LINE.test(line.trim()));
  if (leakedLine) throw new Error('The AI response included document structure outside the substantive body.');
  return sanitized;
}

export function buildDraftAIRequest({
  context,
  communicationType,
  officeProfile,
  signatory,
  recipient,
  recipientRelationship,
  draftMode = 'conservative',
  instruction,
  additionalInstruction,
  contentLength = 'short',
  paragraphStyle = 'balanced',
}) {
  return {
    instructions: GOVERNMENT_DRAFT_SYSTEM_PROMPT,
    input: buildGovernmentDraftPrompt({
      communicationType,
      officeProfile,
      signatory,
      recipient,
      recipientRelationship,
      draftMode,
      context,
      instruction,
      additionalInstruction: [draftContentGuidance(contentLength, paragraphStyle), additionalInstruction].filter(Boolean).join('\n\n'),
    }),
  };
}

function documentInput({
  communicationType,
  documentDetails,
  recipient,
  signatory,
  officeProfile,
  body,
}) {
  return createDraftDocument({
    communicationType,
    metadata: {
      ...documentDetails,
      recipient,
      signatoryId: signatory.id,
      signatory: {
        id: signatory.id,
        name: signatory.name,
        designation: signatory.designation || '',
        telephone: signatory.telephone || '',
        email: signatory.email || '',
      },
      officeProfile,
    },
    body,
    bodySource: 'ai',
    styleProfile: officeProfile.documentStyle,
  });
}

export async function generateDraftBody({
  provider,
  context,
  communicationType,
  officeProfile,
  signatory,
  recipient,
  recipientRelationship,
  draftMode = 'conservative',
  documentDetails = {},
  instruction,
  additionalInstruction,
  contentLength = 'short',
  paragraphStyle = 'balanced',
  signal,
}) {
  requireProvider(provider);
  if (!context?.trim()) throw new Error('The AI context is empty.');
  if (!signatory?.name) throw new Error('Select an authorized signatory before generating the draft.');
  const request = buildDraftAIRequest({
    context,
    communicationType,
    officeProfile,
    signatory,
    recipient,
    recipientRelationship,
    draftMode,
    instruction,
    additionalInstruction,
    contentLength,
    paragraphStyle,
  });
  const response = await provider.generateText({
    operation: 'draft',
    maxOutputTokens: draftContentOutputTokens(contentLength),
    ...request,
    signal,
  });
  const normalizedBody = normalizeAITextResponse(response.text, { operation: 'draft' });
  const body = draftMode === 'conservative' ? constrainConservativeBody(normalizedBody) : normalizedBody;
  const rendered = renderStructuredDraft(documentInput({
    communicationType,
    documentDetails,
    recipient,
    signatory,
    officeProfile,
    body,
  }));
  return {
    ...rendered,
    body,
    model: response.model || provider.id,
    stats: response.stats || {},
  };
}

function bodyRange(document) {
  const rendered = renderStructuredDraft(document);
  const body = rendered.layout.blocks.find((block) => block.role === 'body');
  if (!body) throw new Error('The draft has no editable substantive body.');
  return { ...rendered, body };
}

export function mapRichBodySelectionToDocument(document, selection = {}) {
  const current = bodyRange(document);
  const bodyLength = current.body.content.length;
  const start = Math.max(0, Math.min(bodyLength, Number(selection.start) || 0));
  const end = Math.max(start, Math.min(bodyLength, Number(selection.end) || 0));
  return {
    start: current.body.start + start,
    end: current.body.start + end,
  };
}

function assertCurrentStructuredText(fullText, renderedText) {
  if (String(fullText || '').replace(/\r\n/g, '\n') !== renderedText.replace(/\r\n/g, '\n')) {
    throw new Error('This draft has free-text changes. Save or regenerate a structured draft before using body-only AI tools.');
  }
}

export async function regenerateDraftBodySelection({
  provider,
  document,
  fullText,
  selectionStart,
  selectionEnd,
  context,
  communicationType,
  instruction,
  signal,
}) {
  requireProvider(provider);
  const current = bodyRange(document);
  assertCurrentStructuredText(fullText, current.text);
  if (selectionStart < current.body.start || selectionEnd > current.body.end || selectionStart >= selectionEnd) {
    throw new Error('Select text only within the substantive body. AI cannot rewrite the subject, addressee or signature.');
  }

  const relativeStart = selectionStart - current.body.start;
  const relativeEnd = selectionEnd - current.body.start;
  const selectedText = current.body.content.slice(relativeStart, relativeEnd);
  if (!selectedText.trim()) throw new Error('Select one body passage before regenerating it.');
  const response = await provider.generateText({
    operation: 'paragraph',
    instructions: PARAGRAPH_REWRITE_SYSTEM_PROMPT,
    input: buildParagraphRewriteInput({
      communicationType,
      body: current.body.content,
      selectedText,
      instruction,
      context,
    }),
    signal,
  });
  const replacement = normalizeAITextResponse(response.text, { operation: 'paragraph' });
  const nextBody = `${current.body.content.slice(0, relativeStart)}${replacement}${current.body.content.slice(relativeEnd)}`;
  const nextDocument = replaceDraftBodyBlocks(current.document, nextBody, 'ai');
  const next = renderStructuredDraft(nextDocument);
  const nextBodyRange = next.layout.blocks.find((block) => block.role === 'body');
  const nextSelectionStart = nextBodyRange.start + relativeStart;
  return {
    ...next,
    replacement,
    selection: {
      start: nextSelectionStart,
      end: nextSelectionStart + replacement.length,
    },
    model: response.model || provider.id,
    stats: response.stats || {},
  };
}

export function insertDraftBodyText({
  document,
  fullText,
  selectionStart,
  selectionEnd,
  content,
  source = 'user',
}) {
  const current = bodyRange(document);
  assertCurrentStructuredText(fullText, current.text);
  const insertion = String(content || '').trim();
  if (!insertion) throw new Error('There is no paragraph text to insert.');
  const selectionInsideBody = selectionStart >= current.body.start
    && selectionEnd <= current.body.end
    && selectionStart <= selectionEnd;
  const relativeStart = selectionInsideBody ? selectionStart - current.body.start : current.body.content.length;
  const relativeEnd = selectionInsideBody ? selectionEnd - current.body.start : current.body.content.length;
  const before = current.body.content.slice(0, relativeStart);
  const after = current.body.content.slice(relativeEnd);
  const prefix = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const suffix = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
  const nextBody = `${before}${prefix}${insertion}${suffix}${after}`;
  const nextDocument = replaceDraftBodyBlocks(current.document, nextBody, source);
  const next = renderStructuredDraft(nextDocument);
  const nextBodyRange = next.layout.blocks.find((block) => block.role === 'body');
  const cursor = nextBodyRange.start + before.length + prefix.length + insertion.length;
  return { ...next, selection: { start: cursor, end: cursor } };
}
