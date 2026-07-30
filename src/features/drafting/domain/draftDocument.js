import { getDraftTemplate, templateIdForCommunicationType } from '../templates/templateRegistry.js';
import { DEFAULT_DRAFT_DOCUMENT_STYLE } from '../../../constants/issueConstants.js';
import { buildGovernmentCommunicationTextLayout } from '../../../utils/governmentDraftUtils.js';
import {
  bodyBlocksToRichText,
  mergeBodyBlocksWithRichText,
  normalizeDraftRichText,
  richTextPlainText,
  richTextToBodyBlocks,
} from './draftRichText.js';

export const DRAFT_DOCUMENT_SCHEMA_VERSION = 2;

export const DEFAULT_DRAFT_STYLE = Object.freeze({ ...DEFAULT_DRAFT_DOCUMENT_STYLE });

const BLOCK_SOURCES = new Set(['template', 'user', 'ai', 'paragraph-bank', 'legacy']);

function normalizeMetadata(input = {}) {
  return {
    subject: String(input.subject || ''),
    communicationNumber: String(input.communicationNumber || input.fileNumber || ''),
    issueDate: String(input.issueDate || ''),
    salutation: String(input.salutation || ''),
    copyTo: String(input.copyTo || ''),
    recipient: input.recipient && typeof input.recipient === 'object' ? { ...input.recipient } : {},
    signatoryId: String(input.signatoryId || ''),
    signatory: input.signatory && typeof input.signatory === 'object' ? { ...input.signatory } : {},
    officeProfile: input.officeProfile && typeof input.officeProfile === 'object' ? { ...input.officeProfile } : {},
  };
}

function normalizeBlock(input = {}, index = 0) {
  return {
    id: String(input.id || `block-${index + 1}`),
    role: String(input.role || 'bodyParagraph'),
    content: String(input.content || ''),
    source: BLOCK_SOURCES.has(input.source) ? input.source : 'user',
    locked: Boolean(input.locked),
    alignment: String(input.alignment || ''),
    listType: String(input.listType || ''),
  };
}

export function createDraftDocument({
  communicationType = 'Letter',
  metadata = {},
  body = '',
  bodySource = 'user',
  styleProfile = {},
} = {}) {
  const template = getDraftTemplate(communicationType);
  const paragraphs = String(body || '').split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  const blocks = paragraphs.map((content, index) => normalizeBlock({
    id: `body-${index + 1}`,
    role: 'bodyParagraph',
    content,
    source: bodySource,
  }, index));
  return {
    schemaVersion: DRAFT_DOCUMENT_SCHEMA_VERSION,
    templateId: template.id,
    templateVersion: template.version,
    metadata: normalizeMetadata(metadata),
    blocks,
    bodyRichText: bodyBlocksToRichText(blocks),
    styleProfileSnapshot: { ...DEFAULT_DRAFT_STYLE, ...(styleProfile || {}) },
  };
}

export function legacyDraftToDocument(content, communicationType = 'Letter') {
  const text = String(content || '');
  if (!text.trim()) return null;
  const template = getDraftTemplate(communicationType);
  return {
    schemaVersion: DRAFT_DOCUMENT_SCHEMA_VERSION,
    templateId: template.id,
    templateVersion: template.version,
    metadata: normalizeMetadata(),
    blocks: [normalizeBlock({
      id: 'legacy-document',
      role: 'legacyDocument',
      content: text,
      source: 'legacy',
    })],
    bodyRichText: null,
    styleProfileSnapshot: { ...DEFAULT_DRAFT_STYLE },
  };
}

export function normalizeDraftDocument(input, { content = '', communicationType = 'Letter' } = {}) {
  if (!input || typeof input !== 'object') return legacyDraftToDocument(content, communicationType);
  const template = getDraftTemplate(input.templateId || templateIdForCommunicationType(communicationType));
  const blocks = Array.isArray(input.blocks) ? input.blocks.map(normalizeBlock) : [];
  return {
    schemaVersion: DRAFT_DOCUMENT_SCHEMA_VERSION,
    templateId: template.id,
    templateVersion: Number(input.templateVersion) || template.version,
    metadata: normalizeMetadata(input.metadata),
    blocks,
    bodyRichText: blocks.some((block) => block.role === 'legacyDocument')
      ? null
      : normalizeDraftRichText(input.bodyRichText, blocks),
    styleProfileSnapshot: { ...DEFAULT_DRAFT_STYLE, ...(input.styleProfileSnapshot || {}) },
  };
}

export function replaceDraftBodyBlocks(document, body, source = 'user') {
  const normalized = normalizeDraftDocument(document);
  if (!normalized || normalized.blocks.some((block) => block.role === 'legacyDocument')) {
    throw new Error('A structured draft document is required.');
  }
  const paragraphs = String(body || '').split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  const reusable = new Map();
  normalized.blocks
    .filter((block) => block.role === 'bodyParagraph')
    .forEach((block) => {
      const matches = reusable.get(block.content) || [];
      matches.push(block);
      reusable.set(block.content, matches);
    });
  const blocks = paragraphs.map((content, index) => {
    const previous = reusable.get(content)?.shift();
    return normalizeBlock({
      id: previous?.id || `body-${crypto.randomUUID()}`,
      role: 'bodyParagraph',
      content,
      source: previous?.source || source,
      alignment: previous?.alignment || '',
      listType: previous?.listType || '',
    }, index);
  });
  return {
    ...normalized,
    blocks,
    bodyRichText: mergeBodyBlocksWithRichText(blocks, normalized.bodyRichText),
  };
}

export function replaceDraftBodyRichText(document, bodyRichText, source = 'user') {
  const normalized = normalizeDraftDocument(document);
  if (!normalized || normalized.blocks.some((block) => block.role === 'legacyDocument')) {
    throw new Error('A structured draft document is required.');
  }
  const richText = normalizeDraftRichText(bodyRichText, normalized.blocks);
  return {
    ...normalized,
    blocks: richTextToBodyBlocks(richText, normalized.blocks, source),
    bodyRichText: richText,
  };
}

export function changeDraftDocumentTemplate(document, communicationType) {
  const normalized = normalizeDraftDocument(document);
  if (!normalized || normalized.blocks.some((block) => block.role === 'legacyDocument')) {
    throw new Error('Only structured drafts can change communication type without regenerating.');
  }
  const template = getDraftTemplate(communicationType);
  return {
    ...normalized,
    templateId: template.id,
    templateVersion: template.version,
  };
}

export function renderDraftDocumentText(document, fallback = '') {
  const normalized = normalizeDraftDocument(document, { content: fallback });
  if (!normalized) return String(fallback || '');
  const legacy = normalized.blocks.find((item) => item.role === 'legacyDocument');
  if (legacy) return legacy.content;
  return normalized.blocks.map((item) => item.content.trim()).filter(Boolean).join('\n\n');
}

export function renderStructuredDraft(document) {
  const normalized = normalizeDraftDocument(document);
  if (!normalized || normalized.blocks.some((block) => block.role === 'legacyDocument')) {
    throw new Error('A structured draft document is required.');
  }
  const layout = buildGovernmentCommunicationTextLayout({ document: normalized });
  return { document: normalized, text: layout.text, layout };
}

export function renderDraftClipboardText(document, fallback = '') {
  const normalized = normalizeDraftDocument(document, { content: fallback });
  if (!normalized) return String(fallback || '');
  if (normalized.blocks.some((block) => block.role === 'legacyDocument')) {
    return renderDraftDocumentText(normalized, fallback);
  }
  const rendered = renderStructuredDraft(normalized);
  const body = rendered.layout.blocks.find((block) => block.role === 'body');
  if (!body) return rendered.text;
  const formattedBody = richTextPlainText(normalized.bodyRichText, normalized.blocks);
  return `${rendered.text.slice(0, body.start)}${formattedBody}${rendered.text.slice(body.end)}`;
}

export function validateDraftDocument(document) {
  const normalized = normalizeDraftDocument(document);
  if (!normalized) return { valid: false, errors: [{ field: 'document', message: 'Draft document is required.' }], warnings: [] };
  const template = getDraftTemplate(normalized.templateId);
  const roles = new Set(normalized.blocks.map((item) => item.role));
  const errors = [];
  const warnings = [];

  if (!roles.has('legacyDocument') && !roles.has('bodyParagraph')) {
    errors.push({ field: 'body', message: 'Add at least one body paragraph.' });
  }
  const templateHasRole = (role) => template.blocks.some((item) => item.role === role);
  const templateRequiresRole = (role) => template.blocks.some((item) => item.role === role && item.required);
  const recipient = normalized.metadata.recipient || {};

  if (!normalized.metadata.subject && templateRequiresRole('subject')) {
    warnings.push({ field: 'subject', message: 'Communication subject has not been entered.' });
  }
  if (!normalized.metadata.communicationNumber && templateHasRole('communicationNumber')) {
    warnings.push({ field: 'communicationNumber', message: 'Communication number has not been entered.' });
  }
  if (!normalized.metadata.issueDate && templateHasRole('date')) {
    warnings.push({ field: 'issueDate', message: 'Communication date has not been entered.' });
  }
  if (templateHasRole('recipient') && ![recipient.name, recipient.designation, recipient.organization, recipient.address].some((value) => String(value || '').trim())) {
    warnings.push({ field: 'recipient', message: 'Addressee details have not been entered.' });
  }
  if (templateHasRole('signature') && !normalized.metadata.signatoryId) {
    warnings.push({ field: 'signatoryId', message: 'Authorized signatory has not been selected.' });
  }

  const placeholderPattern = /\[[A-Z][A-Z _/-]*\]/;
  const unresolvedBodyCount = normalized.blocks.filter((item) => placeholderPattern.test(item.content)).length;
  const metadataValues = [
    normalized.metadata.subject,
    normalized.metadata.communicationNumber,
    normalized.metadata.salutation,
    normalized.metadata.copyTo,
    recipient.name,
    recipient.designation,
    recipient.organization,
    recipient.address,
  ];
  if (unresolvedBodyCount || metadataValues.some((value) => placeholderPattern.test(String(value || '')))) {
    warnings.push({
      field: 'placeholders',
      message: unresolvedBodyCount
        ? `${unresolvedBodyCount} body paragraph${unresolvedBodyCount === 1 ? '' : 's'} contain unresolved placeholders.`
        : 'Document details contain unresolved placeholders.',
    });
  }
  return { valid: errors.length === 0, errors, warnings };
}
