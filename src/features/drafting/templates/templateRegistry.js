const BASE_BODY_RULES = {
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

const block = (role, alignment = 'left', options = {}) => ({
  role,
  alignment,
  bold: false,
  uppercase: false,
  required: false,
  ...options,
});

const heading = [
  block('officeHeading', 'center', { required: true }),
  block('communicationNumber', 'center', { required: true }),
  block('date', 'right', { required: true }),
];
const subject = block('subject', 'left', { bold: true, required: true });
const body = block('body', 'justify', { required: true });
const signature = block('signature', 'right', { required: true });

const definitions = [
  {
    id: 'letter',
    label: 'Letter',
    blocks: [...heading, block('recipient', 'left', { required: true }), subject, block('salutation'), body, block('complimentaryClose', 'right'), signature, block('copyList')],
  },
  {
    id: 'do-letter',
    label: 'D.O. Letter',
    blocks: [block('senderIdentity'), block('communicationNumber', 'center', { required: true }), block('officeHeading', 'center'), block('date', 'right'), block('salutation'), body, block('complimentaryClose'), signature, block('recipient')],
  },
  {
    id: 'office-memorandum',
    label: 'Office Memorandum',
    blocks: [...heading, block('documentTitle', 'center', { bold: true, uppercase: true, required: true }), subject, body, signature, block('recipient'), block('copyList')],
  },
  {
    id: 'office-order',
    label: 'Office Order',
    blocks: [...heading, block('documentTitle', 'center', { bold: true, uppercase: true, required: true }), body, signature, block('copyList')],
  },
  {
    id: 'order',
    label: 'Order',
    blocks: [...heading, block('documentTitle', 'center', { bold: true, uppercase: true, required: true }), body, signature, block('copyList')],
  },
  {
    id: 'inter-departmental-note',
    label: 'Inter-Departmental Note',
    blocks: [block('officeHeading', 'center', { required: true }), subject, body, signature, block('recipient'), block('identificationLine')],
  },
  {
    id: 'notification',
    label: 'Notification',
    blocks: [block('publicationDirection', 'center'), ...heading, block('documentTitle', 'center', { bold: true, uppercase: true, required: true }), body, signature, block('recipient'), block('copyList')],
  },
  {
    id: 'resolution',
    label: 'Resolution',
    blocks: [block('publicationDirection', 'center'), ...heading, block('documentTitle', 'center', { bold: true, uppercase: true, required: true }), body, signature, block('publicationOrder', 'left'), signature, block('recipient')],
  },
  {
    id: 'press-communique-note',
    label: 'Press Communique / Note',
    blocks: [block('embargo', 'center'), block('documentTitle', 'center', { bold: true, uppercase: true, required: true }), body, block('officeHeading'), block('date'), block('communicationNumber', 'center'), block('forwardingDirection'), signature],
  },
  {
    id: 'endorsement',
    label: 'Endorsement',
    blocks: [...heading, block('documentTitle', 'center', { bold: true, uppercase: true, required: true }), body, signature, block('copyList'), block('recipient')],
  },
];

export const DRAFT_TEMPLATES = definitions.map((definition) => Object.freeze({
  version: 1,
  bodyInstruction: BASE_BODY_RULES[definition.label],
  ...definition,
  blocks: Object.freeze(definition.blocks.map((item) => Object.freeze(item))),
}));

export const COMMUNICATION_TYPES = DRAFT_TEMPLATES.map((template) => template.label);

const byId = new Map(DRAFT_TEMPLATES.map((template) => [template.id, template]));
const byLabel = new Map(DRAFT_TEMPLATES.map((template) => [template.label, template]));

export function getDraftTemplate(value) {
  return byId.get(value) || byLabel.get(value) || byLabel.get('Letter');
}

export function templateIdForCommunicationType(communicationType) {
  return getDraftTemplate(communicationType).id;
}
