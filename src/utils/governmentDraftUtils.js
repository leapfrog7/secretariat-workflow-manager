import { DEFAULT_DRAFT_DOCUMENT_STYLE, DEFAULT_OFFICE_PROFILE } from '../constants/issueConstants.js';
import { COMMUNICATION_TYPES, getDraftTemplate } from '../features/drafting/templates/templateRegistry.js';

export { COMMUNICATION_TYPES };

export const RECIPIENT_RELATIONSHIPS = [
  'Another Ministry / Department',
  'Subordinate or attached office',
  'State Government',
  'Public sector / autonomous organization',
  'Private organization / individual',
  'Internal officer / section',
];

export function normalizeOfficeProfile(input = {}) {
  return {
    ...DEFAULT_OFFICE_PROFILE,
    ...input,
    authorizedSignatoryIds: Array.isArray(input.authorizedSignatoryIds) ? [...new Set(input.authorizedSignatoryIds.filter(Boolean))] : [],
    documentStyle: {
      ...DEFAULT_DRAFT_DOCUMENT_STYLE,
      ...(input.documentStyle || {}),
    },
  };
}

export function buildGovernmentDraftPrompt({ communicationType, officeProfile, signatory, recipient, recipientRelationship, draftMode = 'conservative', context, instruction }) {
  const profile = normalizeOfficeProfile(officeProfile);
  const senderName = profile.ministry || profile.department || profile.governmentName || 'the issuing office';
  const recipientBlock = formatRecipient(recipient);
  const senderReference = profile.ministry ? 'this Ministry' : profile.department ? 'this Department' : 'this office';

  return [
    `ROLE AND DIRECTION OF COMMUNICATION\nYou are drafting on behalf of ${senderName}. The sender is ${senderName}; the recipient is ${recipientBlock}. This is an outgoing communication from ${senderName} to the recipient, not advice written by the recipient to the Ministry. Refer to the sender institution as "${senderReference}" where needed. Do not reverse the sender and recipient.`,
    `COMMUNICATION TYPE\n${communicationType}`,
    `RECIPIENT RELATIONSHIP\n${recipientRelationship || '[RELATIONSHIP NOT SPECIFIED]'}`,
    `AUTHORIZED SIGNATORY\n${[signatory?.name, signatory?.designation].filter(Boolean).join('\n') || '[AUTHORIZED SIGNATORY]'}`,
    `FORM-SPECIFIC BODY RULE\n${getDraftTemplate(communicationType).bodyInstruction}`,
    `DRAFTING MODE\n${draftMode === 'detailed' ? 'Detailed context mode: use relevant supplied context, but do not infer beyond it.' : 'Conservative mode: restate the purpose/requested action in one concise substantive paragraph. Do not add a second request, explanation, background inference, or courtesy paragraph.'}`,
    `MINISTRY HOUSE STYLE\n${profile.houseStyleNotes?.trim() || 'No additional house-style instruction.'}`,
    'FACT DISCIPLINE\nEvery factual phrase must be traceable to ISSUE CONTEXT, PURPOSE / REQUESTED ACTION, or the configured sender and recipient above. Prefer omission over elaboration. Use the minimum sentences needed and state each request only once. Do not add generic importance, benefits, protocol, urgency, report contents, contact instructions, approvals, legal authority, enclosures, availability of records, or distribution. Do not say that a document is attached, enclosed, or available unless that fact is supplied. Preserve eReceipt numbers, dates, amounts, names, and citations exactly. Use [DETAIL REQUIRED] only when a missing fact is essential to the body.',
    `PERSPECTIVE EXAMPLE\nCorrect: "I am directed to request the Department of Legal Affairs to provide its comments to this Ministry by [DATE]."\nWrong: "The Ministry should send us its comments." The configured Ministry is always the sender.`,
    `PURPOSE / REQUESTED ACTION\n${instruction?.trim() || '[PURPOSE OR REQUESTED ACTION NOT SPECIFIED]'}`,
    'OUTPUT REQUEST\nWrite only the substantive body paragraph or numbered paragraphs. Do not output the government heading, number, date, title, subject, salutation, complimentary close, signature, recipient block, endorsement, copy list, Markdown, preface, or explanation. The application adds those elements programmatically.',
    `ISSUE CONTEXT\n${context}`,
  ].join('\n\n');
}

function communicationBlock(role, content) {
  return content ? { role, content } : null;
}

export function buildGovernmentCommunicationBlocks({ communicationType, officeProfile, signatory, recipient, subject, fileNumber, issueDate, salutation, copyTo, body }) {
  const profile = normalizeOfficeProfile(officeProfile);
  const heading = formatOfficeHeading(profile);
  const number = clean(fileNumber) || '[COMMUNICATION NUMBER]';
  const dateLine = `${profile.placeOfIssue || '[PLACE OF ISSUE]'}, the ${formatOfficialDate(issueDate)}`;
  const subjectLine = clean(subject) || '[SUBJECT]';
  const recipientBlock = formatRecipient(recipient);
  const recipientName = typeof recipient === 'object' ? clean(recipient.name) : '';
  const signature = formatSignature(signatory);
  const content = sanitizeGeneratedBody(body);
  const copies = formatList(copyTo);

  switch (communicationType) {
    case 'D.O. Letter':
      return [
        communicationBlock('senderIdentity', formatSenderIdentity(signatory)),
        communicationBlock('communicationNumber', `D.O. No. ${number}`),
        communicationBlock('officeHeading', heading),
        communicationBlock('date', dateLine),
        communicationBlock('salutation', `${clean(salutation) || `Dear ${recipientName || '[ADDRESSEE NAME]'}`},`),
        communicationBlock('body', content),
        communicationBlock('complimentaryClose', `With regards,\n\nYours sincerely,\n\n(${clean(signatory?.name) || '[SIGNATORY NAME]'})`),
        communicationBlock('recipient', recipientBlock),
      ].filter(Boolean);
    case 'Office Memorandum':
      return [
        communicationBlock('communicationNumber', `No. ${number}`),
        communicationBlock('officeHeading', heading),
        communicationBlock('date', dateLine),
        communicationBlock('documentTitle', 'OFFICE MEMORANDUM'),
        communicationBlock('subject', `Subject: ${subjectLine}`),
        communicationBlock('body', content),
        communicationBlock('signature', signature),
        communicationBlock('recipient', `To\n${recipientBlock}`),
        communicationBlock('copyList', copies && `Copy to:\n${copies}`),
      ].filter(Boolean);
    case 'Office Order':
      return [
        communicationBlock('communicationNumber', `No. ${number}`),
        communicationBlock('officeHeading', heading),
        communicationBlock('date', dateLine),
        communicationBlock('documentTitle', 'OFFICE ORDER'),
        communicationBlock('body', content),
        communicationBlock('signature', `-Sd/-\n${signature}`),
        communicationBlock('copyList', copies && `Copy to:-\n${copies}`),
      ].filter(Boolean);
    case 'Order':
      return [
        communicationBlock('communicationNumber', `No. ${number}`),
        communicationBlock('officeHeading', heading),
        communicationBlock('date', dateLine),
        communicationBlock('documentTitle', 'ORDER'),
        communicationBlock('body', content),
        communicationBlock('signature', `-Sd/-\n${signature}`),
        communicationBlock('copyList', copies && `Copy forwarded to:\n${copies}`),
      ].filter(Boolean);
    case 'Inter-Departmental Note':
      return [
        communicationBlock('officeHeading', heading),
        communicationBlock('subject', `Subject: ${subjectLine}`),
        communicationBlock('body', ensureNumberedParagraphs(content)),
        communicationBlock('signature', signature),
        communicationBlock('recipient', recipientBlock),
        communicationBlock('identificationLine', `${'_'.repeat(64)}\n${profile.department || '[ISSUING DEPARTMENT]'} I.D. No. ${number} dated ${formatOfficialDate(issueDate)}`),
      ].filter(Boolean);
    case 'Notification':
      return [
        communicationBlock('publicationDirection', '(To be published in the Gazette of India [PART AND SECTION])'),
        communicationBlock('officeHeading', heading),
        communicationBlock('communicationNumber', `No. ${number}`),
        communicationBlock('date', dateLine),
        communicationBlock('documentTitle', 'NOTIFICATION'),
        communicationBlock('body', content),
        communicationBlock('signature', `-Sd/-\n${signature}`),
        communicationBlock('recipient', recipientBlock),
        communicationBlock('copyList', copies && `Copy forwarded for information to:\n${copies}`),
      ].filter(Boolean);
    case 'Resolution':
      return [
        communicationBlock('publicationDirection', '[TO BE PUBLISHED IN THE GAZETTE OF INDIA: PART AND SECTION]'),
        communicationBlock('officeHeading', heading),
        communicationBlock('communicationNumber', `No. ${number}`),
        communicationBlock('date', dateLine),
        communicationBlock('documentTitle', 'RESOLUTION'),
        communicationBlock('body', content),
        communicationBlock('signature', `-Sd/-\n${signature}`),
        communicationBlock('publicationOrder', 'ORDER\n[ORDER FOR COMMUNICATION AND/OR PUBLICATION]'),
        communicationBlock('signature', signature),
        communicationBlock('recipient', recipientBlock),
      ].filter(Boolean);
    case 'Press Communique / Note':
      return [
        communicationBlock('embargo', '[EMBARGO DETAILS, IF APPLICABLE]'),
        communicationBlock('documentTitle', 'PRESS COMMUNIQUE / NOTE'),
        communicationBlock('body', ensureNumberedParagraphs(content)),
        communicationBlock('officeHeading', profile.department || '[ISSUING DEPARTMENT]'),
        communicationBlock('date', dateLine),
        communicationBlock('communicationNumber', `No. ${number}`),
        communicationBlock('forwardingDirection', `Forwarded to ${recipientBlock} for issue and publicity.`),
        communicationBlock('signature', signature),
      ].filter(Boolean);
    case 'Endorsement':
      return [
        communicationBlock('communicationNumber', `No. ${number}`),
        communicationBlock('officeHeading', heading),
        communicationBlock('date', dateLine),
        communicationBlock('documentTitle', 'ENDORSEMENT'),
        communicationBlock('body', content),
        communicationBlock('signature', `-Sd/-\n${signature}`),
        communicationBlock('copyList', copies && `List of papers forwarded\n${copies}`),
        communicationBlock('recipient', `To\n${recipientBlock}`),
      ].filter(Boolean);
    case 'Letter':
    default:
      return [
        communicationBlock('communicationNumber', `No. ${number}`),
        communicationBlock('officeHeading', heading),
        communicationBlock('date', dateLine),
        communicationBlock('recipient', `To\n${recipientBlock}`),
        communicationBlock('subject', `Subject: ${subjectLine}`),
        communicationBlock('salutation', `${clean(salutation) || 'Sir/Madam'},`),
        communicationBlock('body', content),
        communicationBlock('complimentaryClose', `Yours faithfully,\n\n-Sd/-\n${signature}`),
        communicationBlock('copyList', copies && `(Endorsement)\nNo. ${number}\nCopy forwarded for information/necessary action to:\n${copies}\n\n${signature}`),
      ].filter(Boolean);
  }
}

export function formatGovernmentCommunication(input) {
  return joinBlocks(...buildGovernmentCommunicationBlocks(input).map((item) => item.content));
}

export function buildGovernmentCommunicationTextLayout({ document }) {
  const metadata = document.metadata || {};
  const communicationType = getDraftTemplate(document.templateId).label;
  const body = (document.blocks || [])
    .filter((item) => item.role === 'bodyParagraph')
    .map((item) => item.content)
    .join('\n\n');
  const blocks = buildGovernmentCommunicationBlocks({
    communicationType,
    officeProfile: metadata.officeProfile,
    signatory: metadata.signatory,
    recipient: metadata.recipient,
    subject: metadata.subject,
    fileNumber: metadata.communicationNumber,
    issueDate: metadata.issueDate,
    salutation: metadata.salutation,
    copyTo: metadata.copyTo,
    body,
  });
  let cursor = 0;
  const positioned = blocks.map((block, index) => {
    if (index) cursor += 2;
    const start = cursor;
    cursor += block.content.length;
    return { ...block, start, end: cursor };
  });
  return {
    text: positioned.map((block) => block.content).join('\n\n'),
    blocks: positioned,
  };
}

export function validateGovernmentCommunication({ communicationType, text }) {
  const required = {
    Letter: ['No. ', 'To\n', 'Subject:', 'Yours faithfully,'],
    'D.O. Letter': ['D.O. No.', 'Yours sincerely,'],
    'Office Memorandum': ['No. ', 'OFFICE MEMORANDUM', 'Subject:', 'To\n'],
    'Office Order': ['No. ', 'OFFICE ORDER'],
    Order: ['No. ', '\nORDER\n'],
    'Inter-Departmental Note': ['Subject:', 'I.D. No.'],
    Notification: ['NOTIFICATION', 'Gazette of India'],
    Resolution: ['RESOLUTION', '\nORDER\n'],
    'Press Communique / Note': ['PRESS COMMUNIQUE / NOTE'],
    Endorsement: ['ENDORSEMENT', 'To\n'],
  }[communicationType] || [];
  const missing = required.filter((marker) => !text.includes(marker));
  return { valid: missing.length === 0, missing };
}

export function constrainConservativeBody(value) {
  const sanitized = sanitizeGeneratedBody(value);
  const firstUnit = sanitized.split(/\n\s*(?=(?:2|II)[.)]\s)|\n\s*\n/i)[0].trim();
  return firstUnit.replace(/^(?:1|I)[.)]\s*/, '') || '[BODY]';
}

function formatOfficeHeading(profile) {
  return [
    profile.governmentName,
    profile.governmentHindiName && `(${profile.governmentHindiName})`,
    profile.ministry,
    profile.department,
    profile.departmentHindiName && `(${profile.departmentHindiName})`,
    profile.division,
    profile.section,
  ].filter(Boolean).join('\n') || '[ISSUING OFFICE DETAILS]';
}

function formatSignature(signatory = {}) {
  return [
    `(${clean(signatory.name) || '[SIGNATORY NAME]'})`,
    clean(signatory.designation) || '[DESIGNATION]',
    signatory.telephone && `Tele: ${clean(signatory.telephone)}`,
    signatory.email && `Email: ${clean(signatory.email)}`,
  ].filter(Boolean).join('\n');
}

function formatSenderIdentity(signatory = {}) {
  return [clean(signatory.name) || '[SIGNATORY NAME]', clean(signatory.designation) || '[DESIGNATION]', signatory.telephone && `Tele: ${clean(signatory.telephone)}`, signatory.email && `Email: ${clean(signatory.email)}`].filter(Boolean).join('\n');
}

function formatRecipient(recipient) {
  if (typeof recipient === 'string') return clean(recipient) || '[RECIPIENT / ADDRESSEE]';
  return [recipient?.name, recipient?.designation, recipient?.organization, recipient?.address].map(clean).filter(Boolean).join('\n') || '[RECIPIENT / ADDRESSEE]';
}

function formatOfficialDate(value) {
  if (!value) return '[DATE]';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return clean(value);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function formatList(value) {
  const lines = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  return lines.map(clean).filter(Boolean).map((line, index) => `${index + 1}. ${line.replace(/^\d+[.)]\s*/, '')}`).join('\n');
}

export function sanitizeGeneratedBody(value) {
  const blockedLine = /^(?:```|office memorandum|office order|order|notification|resolution|press communiqu[eé]|press note|endorsement|subject\s*:|sir\/madam[,:]?|dear\s+|with regards[,:]?|yours (?:faithfully|sincerely)[,:]?|-?sd\/?-?|to\s*:?)$/i;
  const lines = String(value || '').replace(/```(?:text)?/gi, '').split(/\r?\n/);
  const retained = [];
  for (const line of lines) {
    if (/^yours (?:faithfully|sincerely)/i.test(line.trim())) break;
    if (/^subject\s*:/i.test(line.trim())) continue;
    if (!blockedLine.test(line.trim())) retained.push(line);
  }
  return retained.join('\n').trim() || '[BODY]';
}

function ensureNumberedParagraphs(value) {
  const paragraphs = String(value || '').split(/\n\s*\n/).map(clean).filter(Boolean);
  if (!paragraphs.length) return '[BODY]';
  return paragraphs.map((paragraph, index) => /^\d+[.)]\s/.test(paragraph) ? paragraph : `${index + 1}. ${paragraph}`).join('\n\n');
}

function joinBlocks(...blocks) {
  return blocks.filter(Boolean).join('\n\n').trim();
}

function clean(value) {
  return String(value || '').trim();
}
