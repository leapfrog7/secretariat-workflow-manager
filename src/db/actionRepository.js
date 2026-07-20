import { db } from './database';
import {
  isActionDueToday,
  isActionDueWithinSevenDays,
  isActionOpen,
  isActionOverdue,
  isEscalationDue,
  isRecentlyCompleted,
  isReminderDue,
  isTaskInactive,
  normalizeAction,
  sortActionsOperational,
  validateAction,
} from '../utils/actionUtils';
import { addChronologyEvent } from './chronologyRepository';

function requireValidAction(input) {
  const action = normalizeAction(input);
  const { errors, warnings } = validateAction(action);
  if (Object.keys(errors).length) {
    const error = new Error('Action validation failed.');
    error.validationErrors = errors;
    throw error;
  }
  return { action, warnings };
}

export async function getAllActions({ includeArchived = true } = {}) {
  const actions = await db.actions.toArray();
  return actions
    .map(normalizeAction)
    .filter((action) => includeArchived || !action.isArchived)
    .sort(sortActionsOperational);
}

export async function getActionsByIssue(issueId, { includeArchived = true } = {}) {
  const actions = await db.actions.where('issueId').equals(issueId).toArray();
  return actions
    .map(normalizeAction)
    .filter((action) => includeArchived || !action.isArchived)
    .sort(sortActionsOperational);
}

export async function getActionById(id) {
  const action = await db.actions.get(id);
  return action ? normalizeAction(action) : null;
}

export async function createAction(input) {
  const now = new Date().toISOString();
  const { action, warnings } = requireValidAction({
    ...input,
    id: crypto.randomUUID(),
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.actions.add(action);
  await addChronologyEvent({
    issueId: action.issueId,
    recordId: action.recordId,
    actionId: action.id,
    eventType: 'Action created',
    title: action.title,
  });
  return { action, warnings };
}

export async function updateAction(id, input) {
  const existing = await getActionById(id);
  if (!existing) throw new Error('Action not found.');
  const { action, warnings } = requireValidAction({
    ...existing,
    ...input,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await db.actions.put(action);
  return { action, warnings };
}

export async function assignAction(id, { assignedOfficerId, assignedByOfficerId, assignedOn, assignmentInstructions, expectedOutput, dueDate, reason = '' }) {
  const existing = await getActionById(id);
  if (!existing) throw new Error('Action not found.');
  const now = new Date().toISOString();
  const historyItem = {
    id: crypto.randomUUID(),
    previousOfficerId: existing.assignedOfficerId || '',
    newOfficerId: assignedOfficerId || '',
    assignedByOfficerId: assignedByOfficerId || '',
    assignedOn: assignedOn || now,
    reassignmentReason: reason,
    previousDueDate: existing.dueDate || '',
    newDueDate: dueDate || existing.dueDate || '',
  };
  const isReassignment = Boolean(existing.assignedOfficerId && existing.assignedOfficerId !== assignedOfficerId);
  await db.actions.update(id, {
    assignedOfficerId,
    assignedByOfficerId,
    assignedOn: assignedOn || now,
    assignmentInstructions,
    expectedOutput,
    assignedTo: assignedOfficerId || existing.assignedTo,
    dueDate: dueDate || existing.dueDate,
    assignmentHistory: [...existing.assignmentHistory, historyItem],
    updatedAt: now,
  });
  await addChronologyEvent({
    issueId: existing.issueId,
    recordId: existing.recordId,
    actionId: id,
    eventType: isReassignment ? 'Assignment changed' : 'Assignment added',
    title: existing.title,
    description: reason || assignmentInstructions,
  });
}

export async function updateTaskProgress(id, { progressPercent, progressNote, updatedByOfficerId, blocker = '', clarificationRequired = false }) {
  const existing = await getActionById(id);
  if (!existing) throw new Error('Action not found.');
  const now = new Date().toISOString();
  const historyItem = { id: crypto.randomUUID(), progressPercent: Number(progressPercent) || 0, progressNote: progressNote || '', updatedByOfficerId: updatedByOfficerId || '', blocker, clarificationRequired, updatedAt: now };
  await db.actions.update(id, {
    status: clarificationRequired ? 'Awaiting Input' : existing.status === 'Pending' ? 'In Progress' : existing.status,
    progressPercent: historyItem.progressPercent,
    progressNote: historyItem.progressNote,
    lastProgressUpdatedAt: now,
    progressHistory: [...existing.progressHistory, historyItem],
    updatedAt: now,
  });
  if (existing.status === 'Pending') {
    await addChronologyEvent({ issueId: existing.issueId, recordId: existing.recordId, actionId: id, eventType: 'Assignment work started', title: existing.title });
  }
  if (clarificationRequired) {
    await addChronologyEvent({ issueId: existing.issueId, recordId: existing.recordId, actionId: id, eventType: 'Assignment clarification sought', title: existing.title, description: blocker || progressNote });
  }
}

export async function submitTask(id, { submissionNote, outputSummary, submittedByOfficerId }) {
  const existing = await getActionById(id);
  if (!existing) throw new Error('Action not found.');
  const now = new Date().toISOString();
  const historyItem = { id: crypto.randomUUID(), submissionNote: submissionNote || '', outputSummary: outputSummary || '', submittedByOfficerId: submittedByOfficerId || '', submittedOn: now };
  await db.actions.update(id, {
    status: 'Awaiting Input',
    reviewStatus: 'Submitted',
    submittedOn: now,
    submissionNote: submissionNote || outputSummary || existing.submissionNote,
    submissionHistory: [...existing.submissionHistory, historyItem],
    updatedAt: now,
  });
  await addChronologyEvent({ issueId: existing.issueId, recordId: existing.recordId, actionId: id, eventType: 'Assignment submitted', title: existing.title, description: submissionNote || outputSummary });
}

export async function reviewTask(id, { reviewStatus, reviewRemarks, reviewedByOfficerId, revisedDueDate }) {
  const existing = await getActionById(id);
  if (!existing) throw new Error('Action not found.');
  const now = new Date().toISOString();
  const historyItem = { id: crypto.randomUUID(), reviewStatus, reviewRemarks: reviewRemarks || '', reviewedByOfficerId: reviewedByOfficerId || '', reviewedOn: now, revisedDueDate: revisedDueDate || '' };
  const updates = {
    reviewStatus,
    reviewRemarks,
    reviewedByOfficerId,
    reviewedOn: now,
    reviewHistory: [...existing.reviewHistory, historyItem],
    updatedAt: now,
  };
  if (revisedDueDate) updates.dueDate = revisedDueDate;
  if (reviewStatus === 'Accepted' || reviewStatus === 'Closed') {
    updates.status = 'Completed';
    updates.completedAt = now;
    updates.progressPercent = 100;
  }
  if (reviewStatus === 'Returned for Revision') updates.status = 'In Progress';
  await db.actions.update(id, updates);
  const eventType = reviewStatus === 'Returned for Revision' ? 'Assignment returned for revision' : reviewStatus === 'Accepted' ? 'Assignment accepted' : 'Action completed';
  await addChronologyEvent({ issueId: existing.issueId, recordId: existing.recordId, actionId: id, eventType, title: existing.title, description: reviewRemarks });
}

export async function completeAction(id, outcome = '') {
  const existing = await getActionById(id);
  if (!existing) throw new Error('Action not found.');
  await db.actions.update(id, {
    status: 'Completed',
    outcome: outcome || existing.outcome,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await addChronologyEvent({
    issueId: existing.issueId,
    recordId: existing.recordId,
    actionId: id,
    eventType: 'Assignment completed',
    title: existing.title,
    description: outcome || existing.outcome,
  });
}

export async function reopenAction(id) {
  const existing = await getActionById(id);
  if (!existing) throw new Error('Action not found.');
  await db.actions.update(id, {
    status: 'In Progress',
    completedAt: '',
    updatedAt: new Date().toISOString(),
  });
  await addChronologyEvent({
    issueId: existing.issueId,
    recordId: existing.recordId,
    actionId: id,
    eventType: 'Assignment reopened',
    title: existing.title,
  });
}

export async function archiveAction(id) {
  const existing = await getActionById(id);
  if (!existing) throw new Error('Action not found.');
  await db.actions.update(id, { isArchived: true, updatedAt: new Date().toISOString() });
  await addChronologyEvent({
    issueId: existing.issueId,
    recordId: existing.recordId,
    actionId: id,
    eventType: 'Action archived',
    title: existing.title,
  });
}

export async function deleteActionsByIssue(issueId) {
  const actions = await getActionsByIssue(issueId);
  await db.actions.bulkDelete(actions.map((action) => action.id));
}

export async function getActionStatistics() {
  const actions = await getAllActions();
  const active = actions.filter((action) => !action.isArchived);
  const open = active.filter(isActionOpen);
  return {
    total: actions.length,
    active: active.length,
    archived: actions.filter((action) => action.isArchived).length,
    open: open.length,
    allOpen: open,
    completed: active.filter((action) => action.status === 'Completed').length,
    overdue: open.filter(isActionOverdue),
    dueToday: open.filter(isActionDueToday),
    dueSoon: open.filter(isActionDueWithinSevenDays),
    followUpsDue: open.filter(isReminderDue),
    escalationsDue: open.filter(isEscalationDue),
    awaitingInput: open.filter((action) => action.status === 'Awaiting Input').length,
    submittedForApproval: open.filter((action) => action.reviewStatus === 'Submitted').length,
    recentlyCompleted: active.filter(isRecentlyCompleted),
    inactiveTasks: open.filter(isTaskInactive),
    submittedForReview: open.filter((action) => action.reviewStatus === 'Submitted'),
    returnedForRevision: open.filter((action) => action.reviewStatus === 'Returned for Revision'),
    assignedToday: open.filter((action) => action.assignedOn?.slice(0, 10) === new Date().toISOString().slice(0, 10)),
  };
}
