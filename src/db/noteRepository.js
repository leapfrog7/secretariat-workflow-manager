import { db } from './database';
import { queueCloudIssueItemDelete, queueCloudIssueItemUpsert } from '../features/cloud/cloudIssueItemSync';
import {
  normalizeNote,
  noteRevisionSnapshot,
  validateNote,
} from '../features/noting/noteUtils';

export async function getNotesByIssue(issueId) {
  const items = await db.notes.where('issueId').equals(issueId).toArray();
  return items.map(normalizeNote).sort((a, b) => (
    a.sequence - b.sequence || new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  ));
}

export function countNotesByIssue(issueId) {
  return db.notes.where('issueId').equals(issueId).count();
}

export async function saveNote(input) {
  const now = new Date().toISOString();
  const existing = input.id ? await db.notes.get(input.id) : null;
  const highestSequence = existing
    ? existing.sequence
    : await db.notes.where('issueId').equals(input.issueId).toArray()
      .then((items) => Math.max(0, ...items.map((item) => Number(item.sequence) || 0)));
  const note = normalizeNote({
    ...existing,
    ...input,
    id: input.id || crypto.randomUUID(),
    sequence: existing?.sequence || highestSequence + 1,
    version: existing ? Number(existing.version || 1) + 1 : 1,
    revisions: existing
      ? [...(existing.revisions || []), noteRevisionSnapshot(existing)]
      : [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  const errors = validateNote(note);
  if (Object.keys(errors).length) {
    const error = new Error('Note validation failed.');
    error.validationErrors = errors;
    throw error;
  }
  await db.notes.put(note);
  await queueCloudIssueItemUpsert('note', note);
  return note;
}

export async function deleteNote(id) {
  const existing = await db.notes.get(id);
  if (!existing) return false;
  const note = normalizeNote(existing);
  await db.notes.delete(id);
  await queueCloudIssueItemDelete('note', note);
  return true;
}
