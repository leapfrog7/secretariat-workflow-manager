import { db } from './database';
import { normalizeChronologyEvent } from '../utils/chronologyUtils';

export async function addChronologyEvent(input) {
  const event = normalizeChronologyEvent({
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  if (!event.issueId) return null;
  await db.chronology.add(event);
  return event;
}

export async function getChronologyByIssue(issueId) {
  const events = await db.chronology.where('issueId').equals(issueId).toArray();
  return events.map(normalizeChronologyEvent).sort((a, b) => new Date(b.eventDate || 0) - new Date(a.eventDate || 0));
}

export async function deleteChronologyByIssue(issueId) {
  const events = await getChronologyByIssue(issueId);
  await db.chronology.bulkDelete(events.map((event) => event.id));
}
