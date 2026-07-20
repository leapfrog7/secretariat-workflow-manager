import { differenceInCalendarDays, parseISO, subDays } from 'date-fns';
import { ACTION_STATUSES, CLOSED_ACTION_STATUSES, PRIORITIES, REVIEW_STATUSES, TASK_INACTIVITY_DAYS } from '../constants/issueConstants';
import { todayISO } from './dateUtils';

const legacyActionStatusMap = {
  'Not Started': 'Pending',
  'Submitted for Approval': 'Awaiting Input',
};

export function isActionOpen(action) {
  return !action?.isArchived && !CLOSED_ACTION_STATUSES.includes(action.status);
}

export function normalizeAction(input = {}) {
  return {
    id: input.id,
    issueId: input.issueId || '',
    recordId: input.recordId || '',
    title: input.title || '',
    description: input.description || '',
    status: ACTION_STATUSES.includes(input.status) ? input.status : legacyActionStatusMap[input.status] || 'Pending',
    priority: PRIORITIES.includes(input.priority) ? input.priority : 'Normal',
    assignedTo: input.assignedTo || '',
    pendingWith: input.pendingWith || '',
    dueDate: input.dueDate || '',
    reminderDate: input.reminderDate || '',
    escalationDate: input.escalationDate || '',
    dependency: input.dependency || '',
    outcome: input.outcome || '',
    completedAt: input.completedAt || '',
    assignedOfficerId: input.assignedOfficerId || '',
    assignedByOfficerId: input.assignedByOfficerId || '',
    assignedOn: input.assignedOn || '',
    assignmentInstructions: input.assignmentInstructions || '',
    expectedOutput: input.expectedOutput || '',
    progressPercent: Number.isFinite(Number(input.progressPercent)) ? Number(input.progressPercent) : 0,
    progressNote: input.progressNote || '',
    lastProgressUpdatedAt: input.lastProgressUpdatedAt || '',
    submittedOn: input.submittedOn || '',
    submissionNote: input.submissionNote || '',
    reviewedByOfficerId: input.reviewedByOfficerId || '',
    reviewedOn: input.reviewedOn || '',
    reviewStatus: REVIEW_STATUSES.includes(input.reviewStatus) ? input.reviewStatus : 'Not Submitted',
    reviewRemarks: input.reviewRemarks || '',
    assignmentHistory: Array.isArray(input.assignmentHistory) ? input.assignmentHistory : [],
    progressHistory: Array.isArray(input.progressHistory) ? input.progressHistory : [],
    submissionHistory: Array.isArray(input.submissionHistory) ? input.submissionHistory : [],
    reviewHistory: Array.isArray(input.reviewHistory) ? input.reviewHistory : [],
    isArchived: Boolean(input.isArchived),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function createBlankAction(issueId, seed = {}) {
  return normalizeAction({
    issueId,
    status: 'Pending',
    priority: 'Normal',
    ...seed,
  });
}

export function validateAction(action) {
  const errors = {};
  const warnings = {};
  if (!action.issueId) errors.issueId = 'Issue is required.';
  if (!action.title?.trim()) errors.title = 'Title is required.';
  if (action.reminderDate && action.dueDate && action.reminderDate > action.dueDate) {
    warnings.reminderDate = 'Reminder date is after the due date. Save only if this is intentional.';
  }
  if (action.escalationDate && action.dueDate && action.escalationDate < action.dueDate) {
    warnings.escalationDate = 'Escalation date is before the due date. Save only if this is intentional.';
  }
  return { errors, warnings };
}

export function getActionDueState(action) {
  if (!action?.dueDate) return 'none';
  if (!isActionOpen(action)) return 'closed';
  const days = differenceInCalendarDays(parseISO(action.dueDate), new Date());
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'upcoming';
  return 'future';
}

export function isActionOverdue(action) {
  return getActionDueState(action) === 'overdue';
}

export function isActionDueToday(action) {
  return getActionDueState(action) === 'today';
}

export function isActionDueWithinSevenDays(action) {
  return getActionDueState(action) === 'upcoming';
}

export function isReminderDue(action) {
  return isActionOpen(action) && action.reminderDate && action.reminderDate <= todayISO();
}

export function isEscalationDue(action) {
  return isActionOpen(action) && action.escalationDate && action.escalationDate <= todayISO();
}

export function isRecentlyCompleted(action) {
  return action.status === 'Completed' && action.completedAt && parseISO(action.completedAt) >= subDays(new Date(), 7);
}

export function isTaskInactive(action) {
  if (!isActionOpen(action)) return false;
  const anchor = action.lastProgressUpdatedAt || action.assignedOn || action.createdAt;
  if (!anchor) return true;
  return parseISO(anchor) <= subDays(new Date(), TASK_INACTIVITY_DAYS);
}

export function sortActionsOperational(a, b) {
  const stateRank = { overdue: 0, today: 1, upcoming: 2, future: 3, none: 4, closed: 5 };
  const aRank = stateRank[getActionDueState(a)] ?? 9;
  const bRank = stateRank[getActionDueState(b)] ?? 9;
  if (aRank !== bRank) return aRank - bRank;
  const aDue = a.dueDate || '9999-12-31';
  const bDue = b.dueDate || '9999-12-31';
  if (aDue !== bDue) return aDue.localeCompare(bDue);
  return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
}
