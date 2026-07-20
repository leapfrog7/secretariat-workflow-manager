import { db } from './database';
import { normalizeRecord, validateRecord } from '../utils/recordUtils';
import { addChronologyEvent } from './chronologyRepository';

function requireValidRecord(input) {
  const record = normalizeRecord(input);
  const errors = validateRecord(record);
  if (Object.keys(errors).length) {
    const error = new Error('Record validation failed.');
    error.validationErrors = errors;
    throw error;
  }
  return record;
}

export async function getRecordsByIssue(issueId, { includeArchived = true } = {}) {
  const records = await db.records.where('issueId').equals(issueId).toArray();
  return records
    .map(normalizeRecord)
    .filter((record) => includeArchived || !record.isArchived)
    .sort((a, b) => (b.recordDate || '').localeCompare(a.recordDate || '') || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

export async function getRecordById(id) {
  const record = await db.records.get(id);
  return record ? normalizeRecord(record) : null;
}

export async function createRecord(input) {
  const now = new Date().toISOString();
  const record = requireValidRecord({
    ...input,
    id: crypto.randomUUID(),
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.records.add(record);
  await addChronologyEvent({
    issueId: record.issueId,
    recordId: record.id,
    eventType: 'Record created',
    title: record.subject,
    description: `${record.direction} ${record.recordType}`,
  });
  return record;
}

export async function updateRecord(id, input) {
  const existing = await getRecordById(id);
  if (!existing) throw new Error('Record not found.');
  const record = requireValidRecord({
    ...existing,
    ...input,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await db.records.put(record);
  await addChronologyEvent({
    issueId: record.issueId,
    recordId: record.id,
    eventType: 'Record updated',
    title: record.subject,
  });
  return record;
}

export async function archiveRecord(id) {
  const record = await getRecordById(id);
  if (!record) throw new Error('Record not found.');
  await db.records.update(id, { isArchived: true, updatedAt: new Date().toISOString() });
  await addChronologyEvent({
    issueId: record.issueId,
    recordId: id,
    eventType: 'Record archived',
    title: record.subject,
  });
}

export async function deleteRecordsByIssue(issueId) {
  const records = await getRecordsByIssue(issueId);
  await db.records.bulkDelete(records.map((record) => record.id));
}

export async function getRecordStatistics() {
  const records = (await db.records.toArray()).map(normalizeRecord);
  return {
    total: records.length,
    active: records.filter((record) => !record.isArchived).length,
    archived: records.filter((record) => record.isArchived).length,
  };
}
