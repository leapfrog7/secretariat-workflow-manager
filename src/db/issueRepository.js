import { format } from 'date-fns';
import { APP_NAME, DB_NAME, DB_VERSION } from '../constants/issueConstants';
import { db, getSettings, saveSettings } from './database';
import { getDeadlineState, isStaleIssue, sortIssuesDefault, todayISO } from '../utils/dateUtils';
import { normalizeIssue, validateIssue } from '../utils/issueUtils';
import { normalizeAction } from '../utils/actionUtils';
import { normalizeRecord } from '../utils/recordUtils';
import { normalizeChronologyEvent } from '../utils/chronologyUtils';
import { normalizeOfficer } from '../utils/officerUtils';
import { normalizeCommunication } from '../utils/communicationUtils';
import { normalizeReference } from '../utils/referenceUtils';
import { normalizeMilestone } from '../utils/milestoneUtils';
import { normalizeIssueSummary } from '../utils/summaryUtils';
import { addChronologyEvent } from './chronologyRepository';
import { calculateNextAppearance, isScheduledIssue } from '../utils/scheduleUtils';
import { queueCloudIssueDelete, queueCloudIssueUpsert } from '../features/cloud/cloudIssueSync';

function requireValidIssue(input) {
  const issue = normalizeIssue(input);
  const errors = validateIssue(issue);
  if (Object.keys(errors).length) {
    const error = new Error('Issue validation failed.');
    error.validationErrors = errors;
    throw error;
  }
  return issue;
}

export async function reactivateScheduledIssues({ issueId, referenceDate = todayISO() } = {}) {
  const candidates = issueId ? [await db.issues.get(issueId)].filter(Boolean) : await db.issues.toArray();
  const dueIds = candidates
    .filter((issue) => issue.isScheduled && !issue.isArchived && issue.nextAppearanceDate && issue.nextAppearanceDate <= referenceDate)
    .map((issue) => issue.id);
  if (!dueIds.length) return 0;

  const reactivatedIssues = [];
  const count = await db.transaction('rw', db.issues, db.issueMilestones, db.officers, db.chronology, async () => {
    let reactivated = 0;
    for (const id of dueIds) {
      const raw = await db.issues.get(id);
      if (!raw?.isScheduled || raw.isArchived || !raw.nextAppearanceDate || raw.nextAppearanceDate > referenceDate) continue;
      const existing = normalizeIssue(raw);
      const now = new Date().toISOString();
      const oneTime = existing.recurrenceType === 'One-time';
      const nextRecurringAppearance = oneTime ? '' : calculateNextAppearance(existing, referenceDate);
      const issue = normalizeIssue({
        ...existing,
        status: 'Pending',
        dateClosed: '',
        isScheduled: false,
        recurrenceType: oneTime ? '' : existing.recurrenceType,
        nextAppearanceDate: nextRecurringAppearance,
        recurrenceAnchorDay: oneTime ? null : existing.recurrenceAnchorDay,
        lastReactivatedAt: now,
        updatedAt: now,
      });
      const officer = issue.assignedOfficerId ? await db.officers.get(issue.assignedOfficerId) : null;
      await db.issues.put(issue);
      await db.issueMilestones.add(normalizeMilestone({
        id: crypto.randomUUID(),
        issueId: id,
        status: 'Pending',
        assignedOfficerId: issue.assignedOfficerId,
        assignedOfficerName: officer?.name || '',
        note: 'Returned to the current register on its scheduled date.',
        recordedAt: now,
        createdAt: now,
      }));
      await db.chronology.add(normalizeChronologyEvent({
        id: crypto.randomUUID(),
        issueId: id,
        eventType: 'Issue returned',
        title: issue.shortTitle,
        description: 'Returned to the current register on its scheduled date.',
        eventDate: now,
        createdAt: now,
      }));
      reactivatedIssues.push(issue);
      reactivated += 1;
    }
    return reactivated;
  });
  reactivatedIssues.forEach(queueCloudIssueUpsert);
  return count;
}

export async function getAllIssues({ includeArchived = true, includeScheduled = true } = {}) {
  await reactivateScheduledIssues();
  const issues = await db.issues.toArray();
  return issues
    .map(normalizeIssue)
    .filter((issue) => includeArchived || !issue.isArchived)
    .filter((issue) => includeScheduled || !isScheduledIssue(issue))
    .sort(sortIssuesDefault);
}

export async function getIssueById(id) {
  if (!id) return null;
  await reactivateScheduledIssues({ issueId: id });
  const issue = await db.issues.get(id);
  return issue ? normalizeIssue(issue) : null;
}

export async function createIssue(input) {
  const now = new Date().toISOString();
  const issue = requireValidIssue({
    ...input,
    id: crypto.randomUUID(),
    isArchived: false,
    isDemo: Boolean(input.isDemo),
    createdAt: now,
    updatedAt: now,
  });
  await db.transaction('rw', db.issues, db.issueMilestones, db.officers, async () => {
    await db.issues.add(issue);
    const officer = issue.assignedOfficerId ? await db.officers.get(issue.assignedOfficerId) : null;
    await db.issueMilestones.add(normalizeMilestone({
      id: crypto.randomUUID(),
      issueId: issue.id,
      status: issue.status,
      assignedOfficerId: issue.assignedOfficerId,
      assignedOfficerName: officer?.name || '',
      note: issue.currentPosition,
      recordedAt: now,
      createdAt: now,
    }));
  });
  await addChronologyEvent({
    issueId: issue.id,
    eventType: 'Issue created',
    title: issue.shortTitle,
  });
  queueCloudIssueUpsert(issue);
  return issue;
}

export async function updateIssue(id, input) {
  return updateIssuePosition(id, input);
}

export async function updateIssuePosition(id, input) {
  const issue = await db.transaction('rw', db.issues, db.issueMilestones, db.officers, db.chronology, async () => {
    const existingRaw = await db.issues.get(id);
    if (!existingRaw) throw new Error('Issue not found.');
    const existing = normalizeIssue(existingRaw);
    const now = new Date().toISOString();
    let prepared = normalizeIssue({
      ...existing,
      ...input,
      id,
      isDemo: existing.isDemo,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
    if (prepared.recurrenceType === 'Monthly' && prepared.nextAppearanceDate !== existing.nextAppearanceDate) {
      prepared = normalizeIssue({ ...prepared, recurrenceAnchorDay: null });
    }
    const shouldSchedule = prepared.status === 'Completed' && prepared.recurrenceType;
    if (shouldSchedule) {
      const nextAppearanceDate = calculateNextAppearance(prepared);
      prepared = normalizeIssue({
        ...prepared,
        nextAppearanceDate,
        isScheduled: Boolean(nextAppearanceDate),
        dateClosed: prepared.dateClosed || todayISO(),
        lastScheduledAt: nextAppearanceDate ? now : prepared.lastScheduledAt,
      });
    } else if (prepared.status !== 'Completed' || !prepared.recurrenceType) {
      prepared = normalizeIssue({ ...prepared, isScheduled: false });
    }
    const issue = requireValidIssue(prepared);
    const becameScheduled = issue.isScheduled && !existing.isScheduled;
    const changed = issue.status !== existing.status ||
      issue.assignedOfficerId !== existing.assignedOfficerId ||
      issue.currentPosition !== existing.currentPosition ||
      issue.isScheduled !== existing.isScheduled;
    await db.issues.put(issue);
    if (changed) {
      const officer = issue.assignedOfficerId ? await db.officers.get(issue.assignedOfficerId) : null;
      await db.issueMilestones.add(normalizeMilestone({
        id: crypto.randomUUID(),
        issueId: id,
        status: issue.status,
        assignedOfficerId: issue.assignedOfficerId,
        assignedOfficerName: officer?.name || '',
        note: issue.currentPosition,
        recordedAt: issue.updatedAt,
        createdAt: issue.updatedAt,
      }));
    }
    if (becameScheduled) {
      await db.chronology.add(normalizeChronologyEvent({
        id: crypto.randomUUID(),
        issueId: id,
        eventType: 'Issue scheduled',
        title: issue.shortTitle,
        description: `Scheduled to return on ${issue.nextAppearanceDate}.`,
        eventDate: now,
        createdAt: now,
      }));
    }
    return issue;
  });
  queueCloudIssueUpsert(issue);
  return issue;
}

export async function bringBackIssue(id) {
  const issue = await db.transaction('rw', db.issues, db.issueMilestones, db.officers, db.chronology, async () => {
    const raw = await db.issues.get(id);
    if (!raw) throw new Error('Issue not found.');
    const existing = normalizeIssue(raw);
    const now = new Date().toISOString();
    const oneTime = existing.recurrenceType === 'One-time';
    const issue = normalizeIssue({
      ...existing,
      status: 'Pending',
      dateClosed: '',
      isScheduled: false,
      recurrenceType: oneTime ? '' : existing.recurrenceType,
      nextAppearanceDate: oneTime ? '' : existing.nextAppearanceDate,
      recurrenceAnchorDay: oneTime ? null : existing.recurrenceAnchorDay,
      lastReactivatedAt: now,
      updatedAt: now,
    });
    const officer = issue.assignedOfficerId ? await db.officers.get(issue.assignedOfficerId) : null;
    await db.issues.put(issue);
    await db.issueMilestones.add(normalizeMilestone({
      id: crypto.randomUUID(),
      issueId: id,
      status: 'Pending',
      assignedOfficerId: issue.assignedOfficerId,
      assignedOfficerName: officer?.name || '',
      note: 'Brought back to the current register early.',
      recordedAt: now,
      createdAt: now,
    }));
    await db.chronology.add(normalizeChronologyEvent({
      id: crypto.randomUUID(),
      issueId: id,
      eventType: 'Issue returned',
      title: issue.shortTitle,
      description: 'Brought back to the current register early.',
      eventDate: now,
      createdAt: now,
    }));
    return issue;
  });
  queueCloudIssueUpsert(issue);
  return issue;
}

export async function archiveIssue(id) {
  const existing = await getIssueById(id);
  if (!existing) throw new Error('Issue not found.');
  await db.issues.update(id, { isArchived: true, isScheduled: false, updatedAt: new Date().toISOString() });
  await addChronologyEvent({
    issueId: id,
    eventType: 'Issue archived',
    title: existing.shortTitle,
  });
  queueCloudIssueUpsert(await getIssueById(id));
}

export async function restoreIssue(id) {
  const existing = await getIssueById(id);
  if (!existing) throw new Error('Issue not found.');
  await db.issues.update(id, { isArchived: false, updatedAt: new Date().toISOString() });
  await addChronologyEvent({
    issueId: id,
    eventType: 'Issue restored',
    title: existing.shortTitle,
  });
  queueCloudIssueUpsert(await getIssueById(id));
}

export async function permanentlyDeleteIssue(id) {
  await db.transaction('rw', db.issues, db.records, db.actions, db.communications, db.references, db.issueMilestones, db.issueSummaries, db.chronology, async () => {
    const records = await db.records.where('issueId').equals(id).toArray();
    const actions = await db.actions.where('issueId').equals(id).toArray();
    const events = await db.chronology.where('issueId').equals(id).toArray();
    const communications = await db.communications.where('issueId').equals(id).primaryKeys();
    const references = await db.references.where('issueId').equals(id).primaryKeys();
    const milestones = await db.issueMilestones.where('issueId').equals(id).primaryKeys();
    const summaries = await db.issueSummaries.where('issueId').equals(id).primaryKeys();
    await db.records.bulkDelete(records.map((record) => record.id));
    await db.actions.bulkDelete(actions.map((action) => action.id));
    await db.chronology.bulkDelete(events.map((event) => event.id));
    await db.communications.bulkDelete(communications);
    await db.references.bulkDelete(references);
    await db.issueMilestones.bulkDelete(milestones);
    await db.issueSummaries.bulkDelete(summaries);
    await db.issues.delete(id);
  });
  queueCloudIssueDelete(id);
}

export async function getIssueStatistics() {
  const issues = await getAllIssues();
  const active = issues.filter((issue) => !issue.isArchived && !isScheduledIssue(issue));
  const scheduled = issues.filter(isScheduledIssue);
  return {
    total: issues.length,
    active: active.length,
    archived: issues.filter((issue) => issue.isArchived).length,
    scheduled: scheduled.length,
    demo: issues.filter((issue) => issue.isDemo).length,
    openIssues: active.filter((issue) => !['Completed', 'Cancelled'].includes(issue.status)).length,
    pending: active.filter((issue) => issue.status === 'Pending').length,
    inProgress: active.filter((issue) => issue.status === 'In Progress').length,
    awaitingInput: active.filter((issue) => issue.status === 'Awaiting Input').length,
    awaitingDiscussion: active.filter((issue) => issue.status === 'Awaiting Discussion').length,
    completed: active.filter((issue) => issue.status === 'Completed').length,
    cancelled: active.filter((issue) => issue.status === 'Cancelled').length,
    deferred: active.filter((issue) => issue.status === 'Deferred').length,
    highPriority: active.filter((issue) => ['High', 'Critical'].includes(issue.priority)).length,
    overdue: active.filter((issue) => getDeadlineState(issue) === 'overdue'),
    dueSoon: active.filter((issue) => ['today', 'upcoming'].includes(getDeadlineState(issue))),
    withoutNextAction: active.filter((issue) => !['Completed', 'Cancelled'].includes(issue.status) && !issue.nextAction),
    stale: active.filter(isStaleIssue),
  };
}

export async function getRecentIssues(limit = 6) {
  const issues = await getAllIssues({ includeArchived: false, includeScheduled: false });
  return issues.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, limit);
}

export async function getAttentionIssues() {
  const stats = await getIssueStatistics();
  return {
    overdue: stats.overdue,
    dueSoon: stats.dueSoon,
    withoutNextAction: stats.withoutNextAction,
    stale: stats.stale,
  };
}

export async function exportDatabase() {
  const issues = await getAllIssues();
  const actions = (await db.actions.toArray()).map(normalizeAction);
  const records = (await db.records.toArray()).map(normalizeRecord);
  const chronology = (await db.chronology.toArray()).map(normalizeChronologyEvent);
  const communications = (await db.communications.toArray()).map(normalizeCommunication);
  const references = (await db.references.toArray()).map(normalizeReference);
  const issueMilestones = (await db.issueMilestones.toArray()).map(normalizeMilestone);
  const issueSummaries = (await db.issueSummaries.toArray()).map(normalizeIssueSummary);
  const officers = (await db.officers.toArray()).map(normalizeOfficer);
  const settings = await getSettings();
  return {
    metadata: {
      application: APP_NAME,
      exportedAt: new Date().toISOString(),
      databaseName: DB_NAME,
      schemaVersion: DB_VERSION,
      tables: ['issues', 'records', 'actions', 'communications', 'references', 'issueMilestones', 'issueSummaries', 'officers', 'chronology', 'settings'],
    },
    data: {
      issues,
      records,
      actions,
      chronology,
      communications,
      references,
      issueMilestones,
      issueSummaries,
      officers,
      settings,
    },
  };
}

export function createExportFilename() {
  return `secretariat-workflow-manager-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
}

export async function importDatabase(payload) {
  const issuesInput = payload?.data?.issues;
  if (!payload?.metadata || !Array.isArray(issuesInput)) {
    throw new Error('Invalid backup file structure.');
  }
  if (payload.metadata.application && payload.metadata.application !== APP_NAME) {
    throw new Error('Backup does not belong to this application.');
  }
  const now = new Date().toISOString();
  const issues = issuesInput.map((issue) =>
    normalizeIssue({
      ...issue,
      id: issue.id || crypto.randomUUID(),
      createdAt: issue.createdAt || now,
      updatedAt: issue.updatedAt || now,
    }),
  );
  const issueIds = new Set(issues.map((issue) => issue.id));
  const records = Array.isArray(payload.data.records)
    ? payload.data.records
        .map((record) =>
          normalizeRecord({
            ...record,
            id: record.id || crypto.randomUUID(),
            createdAt: record.createdAt || now,
            updatedAt: record.updatedAt || now,
          }),
        )
        .filter((record) => issueIds.has(record.issueId))
    : [];
  const recordIds = new Set(records.map((record) => record.id));
  const actions = Array.isArray(payload.data.actions)
    ? payload.data.actions
        .map((action) =>
          normalizeAction({
            ...action,
            id: action.id || crypto.randomUUID(),
            createdAt: action.createdAt || now,
            updatedAt: action.updatedAt || now,
          }),
        )
        .filter((action) => issueIds.has(action.issueId) && (!action.recordId || recordIds.has(action.recordId)))
    : [];
  const actionIds = new Set(actions.map((action) => action.id));
  const officers = Array.isArray(payload.data.officers)
    ? payload.data.officers.map((officer) =>
        normalizeOfficer({
          ...officer,
          id: officer.id || crypto.randomUUID(),
          createdAt: officer.createdAt || now,
          updatedAt: officer.updatedAt || now,
        }),
      )
    : [];
  const chronology = Array.isArray(payload.data.chronology)
    ? payload.data.chronology
        .map((event) =>
          normalizeChronologyEvent({
            ...event,
            id: event.id || crypto.randomUUID(),
            createdAt: event.createdAt || now,
          }),
        )
        .filter((event) => issueIds.has(event.issueId) && (!event.recordId || recordIds.has(event.recordId)) && (!event.actionId || actionIds.has(event.actionId)))
    : [];
  const communications = Array.isArray(payload.data.communications)
    ? payload.data.communications
        .map((communication) => normalizeCommunication({
          ...communication,
          id: communication.id || crypto.randomUUID(),
          createdAt: communication.createdAt || now,
          updatedAt: communication.updatedAt || now,
        }))
        .filter((communication) => issueIds.has(communication.issueId))
    : [];
  const references = Array.isArray(payload.data.references)
    ? payload.data.references
        .map((reference) => normalizeReference({
          ...reference,
          id: reference.id || crypto.randomUUID(),
          createdAt: reference.createdAt || now,
          updatedAt: reference.updatedAt || now,
        }))
        .filter((reference) => issueIds.has(reference.issueId))
    : [];
  const officerNames = new Map(officers.map((officer) => [officer.id, officer.name]));
  const issueMilestones = Array.isArray(payload.data.issueMilestones)
    ? payload.data.issueMilestones
        .map((milestone) => normalizeMilestone({
          ...milestone,
          id: milestone.id || crypto.randomUUID(),
          createdAt: milestone.createdAt || milestone.recordedAt || now,
        }))
        .filter((milestone) => issueIds.has(milestone.issueId))
    : issues.map((issue) => normalizeMilestone({
        id: crypto.randomUUID(),
        issueId: issue.id,
        status: issue.status,
        assignedOfficerId: issue.assignedOfficerId,
        assignedOfficerName: officerNames.get(issue.assignedOfficerId) || '',
        note: issue.currentPosition,
        recordedAt: issue.updatedAt || issue.createdAt || now,
        createdAt: issue.updatedAt || issue.createdAt || now,
      }));
  const issueSummaries = Array.isArray(payload.data.issueSummaries)
    ? payload.data.issueSummaries
        .map((summary) => normalizeIssueSummary({
          ...summary,
          id: summary.id || crypto.randomUUID(),
          createdAt: summary.createdAt || now,
        }))
        .filter((summary) => issueIds.has(summary.issueId))
    : [];
  await db.transaction('rw', db.issues, db.records, db.actions, db.communications, db.references, db.issueMilestones, db.issueSummaries, db.officers, db.chronology, db.settings, async () => {
    await db.issues.clear();
    await db.records.clear();
    await db.actions.clear();
    await db.chronology.clear();
    await db.communications.clear();
    await db.references.clear();
    await db.issueMilestones.clear();
    await db.issueSummaries.clear();
    await db.officers.clear();
    await db.issues.bulkPut(issues);
    if (records.length) await db.records.bulkPut(records);
    if (actions.length) await db.actions.bulkPut(actions);
    if (chronology.length) await db.chronology.bulkPut(chronology);
    if (communications.length) await db.communications.bulkPut(communications);
    if (references.length) await db.references.bulkPut(references);
    if (issueMilestones.length) await db.issueMilestones.bulkPut(issueMilestones);
    if (issueSummaries.length) await db.issueSummaries.bulkPut(issueSummaries);
    if (officers.length) await db.officers.bulkPut(officers);
    if (payload.data.settings) await saveSettings(payload.data.settings);
  });
  return {
    imported: issues.length,
    recordsImported: records.length,
    actionsImported: actions.length,
    communicationsImported: communications.length,
    referencesImported: references.length,
    milestonesImported: issueMilestones.length,
    summariesImported: issueSummaries.length,
    officersImported: officers.length,
    chronologyImported: chronology.length,
  };
}
