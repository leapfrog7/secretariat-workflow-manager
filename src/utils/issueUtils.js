import { ISSUE_RECURRENCE_TYPES, ISSUE_STATUSES, PRIORITIES, REQUIRED_ISSUE_FIELDS } from '../constants/issueConstants';
import { todayISO } from './dateUtils';

const legacyStatusMap = {
  Active: 'In Progress',
  'Awaiting Internal Decision': 'Pending',
  'Awaiting External Response': 'Awaiting Input',
  'Under Consultation': 'In Progress',
  'Under Litigation': 'In Progress',
  Dormant: 'Deferred',
  Closed: 'Completed',
};

export function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function normalizeCustomFields(value) {
  if (!Array.isArray(value)) return [];
  return value.map((field) => ({
    id: field.id || crypto.randomUUID(),
    label: String(field.label || '').trim(),
    type: ['text', 'textarea', 'number', 'date', 'boolean'].includes(field.type) ? field.type : 'text',
    value: field.type === 'boolean' ? Boolean(field.value) : field.value ?? '',
  }));
}

export function createBlankIssue(settings) {
  return {
    issueNumber: '',
    eFileNumber: '',
    shortTitle: '',
    subject: '',
    subjectType: '',
    organisation: '',
    category: 'Miscellaneous',
    assignedOfficerId: '',
    assignedOn: '',
    priority: '',
    status: 'Pending',
    currentPosition: '',
    pendingWith: '',
    nextAction: '',
    nextDeadline: '',
    dateOpened: todayISO(),
    dateClosed: '',
    recurrenceType: '',
    nextAppearanceDate: '',
    recurrenceAnchorDay: null,
    isScheduled: false,
    description: '',
    tags: [],
    customFields: [],
    isArchived: false,
    isDemo: false,
  };
}

export function normalizeIssue(input = {}) {
  const title = input.shortTitle || input.subject || '';
  const recurrenceType = ISSUE_RECURRENCE_TYPES.includes(input.recurrenceType) ? input.recurrenceType : '';
  const nextAppearanceDate = input.nextAppearanceDate || '';
  const suppliedAnchorDay = Number(input.recurrenceAnchorDay);
  const dateAnchorDay = nextAppearanceDate ? Number(nextAppearanceDate.slice(8, 10)) : null;
  return {
    id: input.id,
    issueNumber: input.issueNumber || '',
    eFileNumber: input.eFileNumber || '',
    shortTitle: title,
    subject: input.subject || title,
    subjectType: input.subjectType || '',
    organisation: input.organisation || '',
    category: input.category || 'Miscellaneous',
    assignedOfficerId: input.assignedOfficerId || '',
    assignedOn: input.assignedOn || '',
    priority: PRIORITIES.includes(input.priority) ? input.priority : '',
    status: ISSUE_STATUSES.includes(input.status) ? input.status : legacyStatusMap[input.status] || 'Pending',
    currentPosition: input.currentPosition || '',
    pendingWith: input.pendingWith || '',
    nextAction: input.nextAction || '',
    nextDeadline: input.nextDeadline || '',
    dateOpened: input.dateOpened || todayISO(),
    dateClosed: input.dateClosed || '',
    recurrenceType,
    nextAppearanceDate: recurrenceType ? nextAppearanceDate : '',
    recurrenceAnchorDay: recurrenceType === 'Monthly' && suppliedAnchorDay >= 1 && suppliedAnchorDay <= 31
      ? suppliedAnchorDay
      : recurrenceType === 'Monthly' ? dateAnchorDay : null,
    isScheduled: Boolean(input.isScheduled),
    lastScheduledAt: input.lastScheduledAt,
    lastReactivatedAt: input.lastReactivatedAt,
    description: input.description || '',
    tags: normalizeTags(input.tags),
    customFields: normalizeCustomFields(input.customFields),
    isArchived: Boolean(input.isArchived),
    isDemo: Boolean(input.isDemo),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function validateIssue(issue) {
  const errors = {};
  REQUIRED_ISSUE_FIELDS.forEach((field) => {
    if (!issue[field] || String(issue[field]).trim() === '') {
      errors[field] = 'This field is required.';
    }
  });
  if (issue.dateClosed && issue.dateOpened && issue.dateClosed < issue.dateOpened) {
    errors.dateClosed = 'Completion date cannot be before date opened.';
  }
  if (issue.recurrenceType && !issue.nextAppearanceDate) {
    errors.nextAppearanceDate = 'Choose when this Issue should return.';
  } else if (issue.recurrenceType && issue.nextAppearanceDate <= todayISO() && !issue.isScheduled && !issue.lastReactivatedAt) {
    errors.nextAppearanceDate = 'The next appearance date must be after today.';
  }
  return errors;
}

export function issueMatchesSearch(issue, query) {
  if (!query) return true;
  const target = [
    issue.shortTitle,
    issue.subject,
    issue.organisation,
    issue.issueNumber,
    issue.eFileNumber,
    issue.subjectType,
    issue.currentPosition,
    issue.pendingWith,
    issue.nextAction,
    issue.nextAppearanceDate,
    issue.description,
    ...(issue.tags || []),
  ]
    .join(' ')
    .toLowerCase();
  return target.includes(query.trim().toLowerCase());
}

export function priorityRank(priority) {
  return { Critical: 0, High: 1, Normal: 2, Low: 3 }[priority] ?? 4;
}
