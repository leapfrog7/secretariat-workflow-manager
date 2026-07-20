import { CHRONOLOGY_EVENT_TYPES } from '../constants/issueConstants';

export function normalizeChronologyEvent(input = {}) {
  return {
    id: input.id,
    issueId: input.issueId || '',
    recordId: input.recordId || '',
    actionId: input.actionId || '',
    eventType: CHRONOLOGY_EVENT_TYPES.includes(input.eventType) ? input.eventType : 'Issue updated',
    title: input.title || '',
    description: input.description || '',
    eventDate: input.eventDate || new Date().toISOString(),
    createdAt: input.createdAt || new Date().toISOString(),
  };
}
