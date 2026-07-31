const BASE_BODY_RULES = {
  Letter: 'Write in formal first-person official voice on behalf of the issuing Ministry or Department. Begin directly with the relevant reference or purpose. Use "I am directed to refer/say/request/inform" only when the supplied record supports communication under Government direction; do not force that phrase into every letter.',
  'D.O. Letter': 'Write in the signatory officer\'s first-person voice to the addressee, using direct, personal, friendly and professional official language with active voice. Come to the issue at the beginning and keep the body succinct, preferably suitable for one page. Do not add the salutation, regards, or close.',
  'Office Memorandum': 'Write throughout in third-person institutional voice. Begin directly, commonly with "Reference is invited to...", "The undersigned is directed to refer/say/inform...", or the operative clarification, according to the supplied facts and authority. Do not use first-person pronouns, a salutation or a complimentary close, and do not mechanically force a direction phrase.',
  'Office Order': 'Write in third-person institutional voice and state the day-to-day internal administrative instruction or decision precisely. Use numbered paragraphs when there is more than one operative point. Do not use first-person pronouns.',
  Order: 'Write in third-person operative language and state only the supplied financial sanction, disciplinary order, authority or decision. Never invent a rule, delegation, Presidential sanction or approval, and do not use first-person pronouns.',
  'I.D. Note': 'Write in third-person institutional voice as a self-contained inter-departmental reference. Set out the issue in numbered paragraphs and end with the precise advice, views, concurrence, comments, clarification, information or action sought from the recipient Department.',
  Notification: 'Draft only the operative Gazette notification text. Never invent an appointment, statutory power, effective date, or Gazette classification.',
  Resolution: 'Draft only the resolution text based on supplied authority and decisions. Do not invent constitutional provisions, Presidential approval, or publication directions.',
  'Press Communique / Note': 'Draft factual public-information paragraphs in neutral institutional language. Do not add publicity claims, quotations, embargoes, or policy rationale.',
  Endorsement: 'Draft a single concise forwarding sentence stating whether the enclosed papers are sent for information, necessary action, or both, exactly as instructed.',
  Other: 'Prepare a clear, concise and professional official communication using only the supplied facts, purpose and authority. Do not invent a prescribed format or shift the sender-recipient perspective.',
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
    label: 'I.D. Note',
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
  {
    id: 'other',
    label: 'Other',
    blocks: [...heading, subject, block('recipient'), body, signature, block('copyList')],
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
byLabel.set('Inter-Departmental Note', byId.get('inter-departmental-note'));

export function getDraftTemplate(value) {
  return byId.get(value) || byLabel.get(value) || byLabel.get('Letter');
}

export function templateIdForCommunicationType(communicationType) {
  return getDraftTemplate(communicationType).id;
}
