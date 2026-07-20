import { DEFAULT_OFFICE_PROFILE } from '../constants/issueConstants.js';

export const COMMUNICATION_TYPES = [
  'Letter',
  'D.O. Letter',
  'Office Memorandum',
  'Office Order',
  'Order',
  'Inter-Departmental Note',
  'Notification',
  'Resolution',
  'Press Communique / Note',
  'Endorsement',
];

export const RECIPIENT_RELATIONSHIPS = [
  'Another Ministry / Department',
  'Subordinate or attached office',
  'State Government',
  'Public sector / autonomous organization',
  'Private organization / individual',
  'Internal officer / section',
];

const FORMAT_CONTRACTS = {
  Letter: 'Write as the issuing Ministry to the named recipient. Use formal institutional prose, normally beginning with a reference or "I am directed to" where supported.',
  'D.O. Letter': 'Write in the signatory officer\'s first-person voice to the addressee, with a courteous and personal official tone. Do not add the salutation, regards, or close.',
  'Office Memorandum': 'Write in impersonal institutional prose. "The undersigned is directed to" may be used where appropriate. Do not use a salutation or complimentary close.',
  'Office Order': 'State the internal administrative direction precisely. Use numbered paragraphs when there is more than one operative point.',
  Order: 'State only the supplied authority, sanction, or operative decision. Never invent a rule, delegation, Presidential sanction, or approval.',
  'Inter-Departmental Note': 'Set out the issue in numbered paragraphs and end with the precise advice, concurrence, information, or action sought from the recipient Department.',
  Notification: 'Draft only the operative Gazette notification text. Never invent an appointment, statutory power, effective date, or Gazette classification.',
  Resolution: 'Draft only the resolution text based on supplied authority and decisions. Do not invent constitutional provisions, Presidential approval, or publication directions.',
  'Press Communique / Note': 'Draft factual public-information paragraphs in neutral institutional language. Do not add publicity claims, quotations, embargoes, or policy rationale.',
  Endorsement: 'Draft a single concise forwarding sentence stating whether the enclosed papers are sent for information, necessary action, or both, exactly as instructed.',
};

export function normalizeOfficeProfile(input = {}) {
  return {
    ...DEFAULT_OFFICE_PROFILE,
    ...input,
    authorizedSignatoryIds: Array.isArray(input.authorizedSignatoryIds) ? [...new Set(input.authorizedSignatoryIds.filter(Boolean))] : [],
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
    `FORM-SPECIFIC BODY RULE\n${FORMAT_CONTRACTS[communicationType] || FORMAT_CONTRACTS.Letter}`,
    `DRAFTING MODE\n${draftMode === 'detailed' ? 'Detailed context mode: use relevant supplied context, but do not infer beyond it.' : 'Conservative mode: restate the purpose/requested action in one concise substantive paragraph. Do not add a second request, explanation, background inference, or courtesy paragraph.'}`,
    `MINISTRY HOUSE STYLE\n${profile.houseStyleNotes?.trim() || 'No additional house-style instruction.'}`,
    'FACT DISCIPLINE\nEvery factual phrase must be traceable to ISSUE CONTEXT, PURPOSE / REQUESTED ACTION, or the configured sender and recipient above. Prefer omission over elaboration. Use the minimum sentences needed and state each request only once. Do not add generic importance, benefits, protocol, urgency, report contents, contact instructions, approvals, legal authority, enclosures, availability of records, or distribution. Do not say that a document is attached, enclosed, or available unless that fact is supplied. Preserve eReceipt numbers, dates, amounts, names, and citations exactly. Use [DETAIL REQUIRED] only when a missing fact is essential to the body.',
    `PERSPECTIVE EXAMPLE\nCorrect: "I am directed to request the Department of Legal Affairs to provide its comments to this Ministry by [DATE]."\nWrong: "The Ministry should send us its comments." The configured Ministry is always the sender.`,
    `PURPOSE / REQUESTED ACTION\n${instruction?.trim() || '[PURPOSE OR REQUESTED ACTION NOT SPECIFIED]'}`,
    'OUTPUT REQUEST\nWrite only the substantive body paragraph or numbered paragraphs. Do not output the government heading, number, date, title, subject, salutation, complimentary close, signature, recipient block, endorsement, copy list, Markdown, preface, or explanation. The application adds those elements programmatically.',
    `ISSUE CONTEXT\n${context}`,
  ].join('\n\n');
}

export function formatGovernmentCommunication({ communicationType, officeProfile, signatory, recipient, subject, fileNumber, issueDate, salutation, copyTo, body }) {
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
      return joinBlocks(
        formatSenderIdentity(signatory),
        `D.O. No. ${number}\n\n${heading}\n\n${dateLine}`,
        `${clean(salutation) || `Dear ${recipientName || '[ADDRESSEE NAME]'}`},`,
        content,
        `With regards,\n\nYours sincerely,\n\n(${clean(signatory?.name) || '[SIGNATORY NAME]'})`,
        recipientBlock,
      );
    case 'Office Memorandum':
      return joinBlocks(
        `No. ${number}\n${heading}\n\n${dateLine}`,
        'OFFICE MEMORANDUM',
        `Subject: ${subjectLine}`,
        content,
        signature,
        `To\n${recipientBlock}`,
        copies && `Copy to:\n${copies}`,
      );
    case 'Office Order':
      return joinBlocks(
        `No. ${number}\n${heading}\n\n${dateLine}`,
        'OFFICE ORDER',
        content,
        `-Sd/-\n${signature}`,
        copies && `Copy to:-\n${copies}`,
      );
    case 'Order':
      return joinBlocks(
        `No. ${number}\n${heading}\n\n${dateLine}`,
        'ORDER',
        content,
        `-Sd/-\n${signature}`,
        copies && `Copy forwarded to:\n${copies}`,
      );
    case 'Inter-Departmental Note':
      return joinBlocks(
        heading,
        `Subject: ${subjectLine}`,
        ensureNumberedParagraphs(content),
        signature,
        recipientBlock,
        `${'_'.repeat(64)}\n${profile.department || '[ISSUING DEPARTMENT]'} I.D. No. ${number} dated ${formatOfficialDate(issueDate)}`,
      );
    case 'Notification':
      return joinBlocks(
        '(To be published in the Gazette of India [PART AND SECTION])',
        `${heading}\n\n${dateLine}`,
        'NOTIFICATION',
        `No. ${number}. ${content}`,
        `-Sd/-\n${signature}`,
        recipientBlock,
        copies && `Copy forwarded for information to:\n${copies}`,
      );
    case 'Resolution':
      return joinBlocks(
        '[TO BE PUBLISHED IN THE GAZETTE OF INDIA: PART AND SECTION]',
        `${heading}\n\n${dateLine}`,
        'RESOLUTION',
        content,
        `-Sd/-\n${signature}`,
        'ORDER\n[ORDER FOR COMMUNICATION AND/OR PUBLICATION]',
        signature,
        recipientBlock,
      );
    case 'Press Communique / Note':
      return joinBlocks(
        '[EMBARGO DETAILS, IF APPLICABLE]',
        'PRESS COMMUNIQUE / NOTE',
        ensureNumberedParagraphs(content),
        `${profile.department || '[ISSUING DEPARTMENT]'}\n${dateLine}\nNo. ${number}`,
        `Forwarded to ${recipientBlock} for issue and publicity.`,
        signature,
      );
    case 'Endorsement':
      return joinBlocks(
        `No. ${number}\n${heading}\n\n${dateLine}`,
        'ENDORSEMENT',
        content,
        `-Sd/-\n${signature}`,
        copies && `List of papers forwarded\n${copies}`,
        `To\n${recipientBlock}`,
      );
    case 'Letter':
    default:
      return joinBlocks(
        `No. ${number}\n${heading}\n\n${dateLine}`,
        `To\n${recipientBlock}`,
        `Subject: ${subjectLine}`,
        `${clean(salutation) || 'Sir/Madam'},`,
        content,
        `Yours faithfully,\n\n-Sd/-\n${signature}`,
        copies && `(Endorsement)\nNo. ${number}\nCopy forwarded for information/necessary action to:\n${copies}\n\n${signature}`,
      );
  }
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

function sanitizeGeneratedBody(value) {
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
