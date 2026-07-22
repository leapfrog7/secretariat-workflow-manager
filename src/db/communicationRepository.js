import { db } from './database';
import { normalizeCommunication, validateCommunication } from '../utils/communicationUtils';
import { queueCloudIssueItemDelete, queueCloudIssueItemUpsert } from '../features/cloud/cloudIssueItemSync';

function requireValidCommunication(input) {
  const communication = normalizeCommunication(input);
  const errors = validateCommunication(communication);
  if (Object.keys(errors).length) {
    const error = new Error('Communication validation failed.');
    error.validationErrors = errors;
    throw error;
  }
  return communication;
}

export async function getCommunicationsByIssue(issueId) {
  const items = await db.communications.where('issueId').equals(issueId).toArray();
  return items
    .map(normalizeCommunication)
    .sort((a, b) => b.communicationDate.localeCompare(a.communicationDate) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function getAllCommunications() {
  const items = await db.communications.toArray();
  return items
    .map(normalizeCommunication)
    .sort((a, b) => b.communicationDate.localeCompare(a.communicationDate) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function saveCommunication(input) {
  const now = new Date().toISOString();
  const existing = input.id ? await db.communications.get(input.id) : null;
  const communication = requireValidCommunication({
    ...existing,
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  await db.communications.put(communication);
  queueCloudIssueItemUpsert('communication', communication);
  return communication;
}

export async function deleteCommunication(id) {
  await db.communications.delete(id);
  queueCloudIssueItemDelete('communication', id);
}
