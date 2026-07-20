import { RECORD_DIRECTIONS, RECORD_TYPES } from '../constants/issueConstants';
import { todayISO } from './dateUtils';

export function createBlankRecord(issueId, seed = {}) {
  return normalizeRecord({
    issueId,
    recordType: 'Incoming Communication',
    direction: 'Incoming',
    recordDate: todayISO(),
    ...seed,
  });
}

export function normalizeRecord(input = {}) {
  return {
    id: input.id,
    issueId: input.issueId || '',
    recordNumber: input.recordNumber || '',
    recordType: RECORD_TYPES.includes(input.recordType) ? input.recordType : 'Other',
    direction: RECORD_DIRECTIONS.includes(input.direction) ? input.direction : 'Internal',
    subject: input.subject || '',
    organisation: input.organisation || '',
    senderReceiver: input.senderReceiver || '',
    recordDate: input.recordDate || todayISO(),
    receivedDate: input.receivedDate || '',
    summary: input.summary || '',
    notes: input.notes || '',
    tags: Array.isArray(input.tags) ? input.tags : [],
    isArchived: Boolean(input.isArchived),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function validateRecord(record) {
  const errors = {};
  if (!record.issueId) errors.issueId = 'Issue is required.';
  if (!record.subject?.trim()) errors.subject = 'Subject is required.';
  if (!record.recordDate) errors.recordDate = 'Record date is required.';
  if (!record.recordType) errors.recordType = 'Record type is required.';
  if (!record.direction) errors.direction = 'Direction is required.';
  return errors;
}

export function recordMatchesSearch(record, query) {
  if (!query) return true;
  const target = [
    record.recordNumber,
    record.recordType,
    record.direction,
    record.subject,
    record.organisation,
    record.senderReceiver,
    record.summary,
    record.notes,
    ...(record.tags || []),
  ].join(' ').toLowerCase();
  return target.includes(query.trim().toLowerCase());
}
