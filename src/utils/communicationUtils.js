import { todayISO } from './dateUtils';

export const COMMUNICATION_TYPES = [
  'Comments received',
  'Reminder issued',
  'Letter received',
  'Letter issued',
  'Email received',
  'Email issued',
  'Meeting / discussion',
  'Telephone discussion',
  'Other',
];

export function normalizeCommunication(input = {}) {
  return {
    id: input.id,
    issueId: input.issueId || '',
    communicationDate: input.communicationDate || todayISO(),
    communicationType: COMMUNICATION_TYPES.includes(input.communicationType) ? input.communicationType : 'Comments received',
    correspondent: input.correspondent || '',
    details: input.details || '',
    eReceiptNumber: input.eReceiptNumber || '',
    documentDate: input.documentDate || '',
    sourceSubject: input.sourceSubject || '',
    sourceFileName: input.sourceFileName || '',
    sourceLocation: input.sourceLocation || '',
    relevantPages: input.relevantPages || '',
    sourceDigest: input.sourceDigest || '',
    keyFacts: input.keyFacts || '',
    draftId: input.draftId || '',
    draftVersion: Number(input.draftVersion) || 0,
    officialCommunicationType: input.officialCommunicationType || '',
    signatoryId: input.signatoryId || '',
    signatoryName: input.signatoryName || '',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function validateCommunication(communication) {
  const errors = {};
  if (!communication.communicationDate) errors.communicationDate = 'Date is required.';
  if (!communication.details?.trim()) errors.details = 'Communication details are required.';
  return errors;
}

const SEARCH_FIELDS = [
  ['eReceiptNumber', 'eReceipt number'],
  ['sourceSubject', 'Document subject'],
  ['correspondent', 'Organisation / person'],
  ['sourceFileName', 'File name'],
  ['sourceLocation', 'Document location'],
  ['sourceDigest', 'Source digest'],
  ['keyFacts', 'Key facts / directions'],
  ['details', 'Communication details'],
  ['communicationType', 'Communication type'],
  ['documentDate', 'Document date'],
  ['communicationDate', 'Communication date'],
];

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeIdentifier(value) {
  return normalizeSearchText(value).replace(/[\s/\\-]+/g, '');
}

export function getCommunicationSearchContext(communications, query) {
  const searchText = normalizeSearchText(query);
  if (!searchText) return null;
  const compactQuery = normalizeIdentifier(searchText);
  const matches = [];

  communications.forEach((communication) => {
    let bestField = null;
    let score = Number.POSITIVE_INFINITY;
    SEARCH_FIELDS.forEach(([field, label], fieldIndex) => {
      const value = normalizeSearchText(communication[field]);
      if (!value) return;
      const identifierMatch = field === 'eReceiptNumber' && compactQuery && normalizeIdentifier(value).includes(compactQuery);
      if (!value.includes(searchText) && !identifierMatch) return;
      const exact = value === searchText || (field === 'eReceiptNumber' && normalizeIdentifier(value) === compactQuery);
      const nextScore = fieldIndex * 10 + (exact ? 0 : 1);
      if (nextScore < score) {
        score = nextScore;
        bestField = { field, label, value: communication[field] };
      }
    });
    if (bestField) matches.push({ communication, bestField, score });
  });

  if (!matches.length) return null;
  matches.sort((a, b) => a.score - b.score || b.communication.communicationDate.localeCompare(a.communication.communicationDate));
  const first = matches[0];
  return {
    communicationId: first.communication.id,
    count: matches.length,
    matchedField: first.bestField.label,
    matchedValue: first.bestField.value,
    eReceiptNumber: first.communication.eReceiptNumber,
    subject: first.communication.sourceSubject,
    correspondent: first.communication.correspondent,
    date: first.communication.documentDate || first.communication.communicationDate,
  };
}
