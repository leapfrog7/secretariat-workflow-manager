import Dexie from 'dexie';
import { DB_NAME, DB_VERSION, DEFAULT_LOCAL_AI_SETTINGS, DEFAULT_OFFICE_PROFILE, DEFAULT_SETTINGS, SETTINGS_ID } from '../constants/issueConstants';

export const db = new Dexie(DB_NAME);

db.version(1).stores({
  issues:
    'id, issueNumber, organisation, category, priority, status, nextDeadline, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  settings: 'id',
});

db.version(2).stores({
  issues:
    'id, issueNumber, organisation, category, priority, status, nextDeadline, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  actions:
    'id, issueId, recordId, status, priority, assignedTo, pendingWith, dueDate, reminderDate, escalationDate, isArchived, completedAt, createdAt, updatedAt',
  settings: 'id',
});

db.version(3).stores({
  issues:
    'id, issueNumber, organisation, category, priority, status, nextDeadline, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  records:
    'id, issueId, recordNumber, recordType, direction, organisation, recordDate, receivedDate, isArchived, createdAt, updatedAt',
  actions:
    'id, issueId, recordId, status, priority, assignedTo, pendingWith, dueDate, reminderDate, escalationDate, isArchived, completedAt, createdAt, updatedAt',
  chronology:
    'id, issueId, recordId, actionId, eventType, eventDate, createdAt',
  settings: 'id',
});

db.version(4).stores({
  issues:
    'id, issueNumber, organisation, category, priority, status, nextDeadline, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  records:
    'id, issueId, recordNumber, recordType, direction, organisation, recordDate, receivedDate, isArchived, createdAt, updatedAt',
  actions:
    'id, issueId, recordId, assignedOfficerId, assignedByOfficerId, reviewStatus, status, priority, assignedTo, pendingWith, dueDate, reminderDate, escalationDate, isArchived, completedAt, assignedOn, submittedOn, lastProgressUpdatedAt, createdAt, updatedAt',
  officers: 'id, name, designation, section, role, isActive, createdAt, updatedAt',
  chronology:
    'id, issueId, recordId, actionId, eventType, eventDate, createdAt',
  settings: 'id',
});

db.version(5).stores({
  issues:
    'id, issueNumber, assignedOfficerId, organisation, category, priority, status, nextDeadline, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  records:
    'id, issueId, recordNumber, recordType, direction, organisation, recordDate, receivedDate, isArchived, createdAt, updatedAt',
  actions:
    'id, issueId, recordId, assignedOfficerId, assignedByOfficerId, reviewStatus, status, priority, assignedTo, pendingWith, dueDate, reminderDate, escalationDate, isArchived, completedAt, assignedOn, submittedOn, lastProgressUpdatedAt, createdAt, updatedAt',
  officers: 'id, name, designation, section, role, isActive, createdAt, updatedAt',
  chronology:
    'id, issueId, recordId, actionId, eventType, eventDate, createdAt',
  settings: 'id',
});

db.version(6).stores({
  issues:
    'id, eFileNumber, subjectType, assignedOfficerId, organisation, category, priority, status, nextDeadline, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  records:
    'id, issueId, recordNumber, recordType, direction, organisation, recordDate, receivedDate, isArchived, createdAt, updatedAt',
  actions:
    'id, issueId, recordId, assignedOfficerId, assignedByOfficerId, reviewStatus, status, priority, assignedTo, pendingWith, dueDate, reminderDate, escalationDate, isArchived, completedAt, assignedOn, submittedOn, lastProgressUpdatedAt, createdAt, updatedAt',
  officers: 'id, name, designation, section, role, isActive, createdAt, updatedAt',
  chronology:
    'id, issueId, recordId, actionId, eventType, eventDate, createdAt',
  settings: 'id',
}).upgrade(async (transaction) => {
  const officers = await transaction.table('officers').toArray();
  const generatedOfficerIds = new Set(
    officers
      .filter((officer) =>
        officer.section === 'Administration' &&
        [
          ['Section Officer', 'Section Officer', 'Section Officer'],
          ['Assistant Section Officer', 'ASO', 'Assistant Section Officer'],
          ['Dealing Assistant', 'Assistant', 'Dealing Assistant'],
        ].some(([name, designation, role]) => officer.name === name && officer.designation === designation && officer.role === role),
      )
      .map((officer) => officer.id),
  );

  if (!generatedOfficerIds.size) return;

  await transaction.table('issues').toCollection().modify((issue) => {
    if (generatedOfficerIds.has(issue.assignedOfficerId)) {
      issue.assignedOfficerId = '';
      issue.assignedOn = '';
    }
  });
  await transaction.table('actions').toCollection().modify((action) => {
    if (generatedOfficerIds.has(action.assignedOfficerId)) action.assignedOfficerId = '';
    if (generatedOfficerIds.has(action.assignedByOfficerId)) action.assignedByOfficerId = '';
    if (generatedOfficerIds.has(action.assignedTo)) action.assignedTo = '';
  });
  await transaction.table('officers').bulkDelete([...generatedOfficerIds]);
});

db.version(7).stores({
  issues:
    'id, eFileNumber, subjectType, assignedOfficerId, organisation, category, priority, status, nextDeadline, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  records:
    'id, issueId, recordNumber, recordType, direction, organisation, recordDate, receivedDate, isArchived, createdAt, updatedAt',
  actions:
    'id, issueId, recordId, assignedOfficerId, assignedByOfficerId, reviewStatus, status, priority, assignedTo, pendingWith, dueDate, reminderDate, escalationDate, isArchived, completedAt, assignedOn, submittedOn, lastProgressUpdatedAt, createdAt, updatedAt',
  communications: 'id, issueId, communicationDate, communicationType, createdAt, updatedAt',
  references: 'id, issueId, referenceDate, createdAt, updatedAt',
  officers: 'id, name, designation, section, role, isActive, createdAt, updatedAt',
  chronology:
    'id, issueId, recordId, actionId, eventType, eventDate, createdAt',
  settings: 'id',
});

db.version(8).stores({
  issues:
    'id, eFileNumber, subjectType, assignedOfficerId, organisation, category, priority, status, nextDeadline, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  records:
    'id, issueId, recordNumber, recordType, direction, organisation, recordDate, receivedDate, isArchived, createdAt, updatedAt',
  actions:
    'id, issueId, recordId, assignedOfficerId, assignedByOfficerId, reviewStatus, status, priority, assignedTo, pendingWith, dueDate, reminderDate, escalationDate, isArchived, completedAt, assignedOn, submittedOn, lastProgressUpdatedAt, createdAt, updatedAt',
  communications: 'id, issueId, communicationDate, communicationType, createdAt, updatedAt',
  references: 'id, issueId, referenceDate, createdAt, updatedAt',
  issueMilestones: 'id, issueId, recordedAt, createdAt',
  officers: 'id, name, designation, section, role, isActive, createdAt, updatedAt',
  chronology:
    'id, issueId, recordId, actionId, eventType, eventDate, createdAt',
  settings: 'id',
}).upgrade(async (transaction) => {
  const [issues, officers] = await Promise.all([
    transaction.table('issues').toArray(),
    transaction.table('officers').toArray(),
  ]);
  const officerNames = new Map(officers.map((officer) => [officer.id, officer.name]));
  const now = new Date().toISOString();
  const milestones = issues.map((issue) => {
    const recordedAt = issue.updatedAt || issue.createdAt || now;
    return {
      id: crypto.randomUUID(),
      issueId: issue.id,
      status: issue.status || 'Pending',
      assignedOfficerId: issue.assignedOfficerId || '',
      assignedOfficerName: officerNames.get(issue.assignedOfficerId) || '',
      note: issue.currentPosition || '',
      recordedAt,
      createdAt: recordedAt,
    };
  });
  if (milestones.length) await transaction.table('issueMilestones').bulkAdd(milestones);
});

db.version(9).stores({
  issues:
    'id, eFileNumber, subjectType, assignedOfficerId, organisation, category, priority, status, nextDeadline, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  records:
    'id, issueId, recordNumber, recordType, direction, organisation, recordDate, receivedDate, isArchived, createdAt, updatedAt',
  actions:
    'id, issueId, recordId, assignedOfficerId, assignedByOfficerId, reviewStatus, status, priority, assignedTo, pendingWith, dueDate, reminderDate, escalationDate, isArchived, completedAt, assignedOn, submittedOn, lastProgressUpdatedAt, createdAt, updatedAt',
  communications: 'id, issueId, communicationDate, communicationType, createdAt, updatedAt',
  references: 'id, issueId, referenceDate, createdAt, updatedAt',
  issueMilestones: 'id, issueId, recordedAt, createdAt',
  issueSummaries: 'id, issueId, version, createdAt',
  officers: 'id, name, designation, section, role, isActive, createdAt, updatedAt',
  chronology:
    'id, issueId, recordId, actionId, eventType, eventDate, createdAt',
  settings: 'id',
});

db.version(10).stores({
  issues:
    'id, eFileNumber, subjectType, assignedOfficerId, organisation, category, priority, status, nextDeadline, nextAppearanceDate, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  records:
    'id, issueId, recordNumber, recordType, direction, organisation, recordDate, receivedDate, isArchived, createdAt, updatedAt',
  actions:
    'id, issueId, recordId, assignedOfficerId, assignedByOfficerId, reviewStatus, status, priority, assignedTo, pendingWith, dueDate, reminderDate, escalationDate, isArchived, completedAt, assignedOn, submittedOn, lastProgressUpdatedAt, createdAt, updatedAt',
  communications: 'id, issueId, communicationDate, communicationType, createdAt, updatedAt',
  references: 'id, issueId, referenceDate, createdAt, updatedAt',
  issueMilestones: 'id, issueId, recordedAt, createdAt',
  issueSummaries: 'id, issueId, version, createdAt',
  officers: 'id, name, designation, section, role, isActive, createdAt, updatedAt',
  chronology:
    'id, issueId, recordId, actionId, eventType, eventDate, createdAt',
  settings: 'id',
});

db.version(11).stores({
  issues:
    'id, eFileNumber, subjectType, assignedOfficerId, organisation, category, priority, status, nextDeadline, nextAppearanceDate, dateOpened, isArchived, isDemo, createdAt, updatedAt',
  records:
    'id, issueId, recordNumber, recordType, direction, organisation, recordDate, receivedDate, isArchived, createdAt, updatedAt',
  actions:
    'id, issueId, recordId, assignedOfficerId, assignedByOfficerId, reviewStatus, status, priority, assignedTo, pendingWith, dueDate, reminderDate, escalationDate, isArchived, completedAt, assignedOn, submittedOn, lastProgressUpdatedAt, createdAt, updatedAt',
  communications: 'id, issueId, communicationDate, communicationType, createdAt, updatedAt',
  references: 'id, issueId, referenceDate, createdAt, updatedAt',
  issueMilestones: 'id, issueId, recordedAt, createdAt',
  issueSummaries: 'id, issueId, version, createdAt',
  drafts: 'id, issueId, version, communicationType, status, createdAt, updatedAt',
  syncTombstones: 'id, entityType, itemId, deletedAt',
  officers: 'id, name, designation, section, role, isActive, createdAt, updatedAt',
  chronology:
    'id, issueId, recordId, actionId, eventType, eventDate, createdAt',
  settings: 'id',
});

export async function getSettings() {
  const settings = await db.settings.get(SETTINGS_ID);
  if (settings) return {
    ...DEFAULT_SETTINGS,
    ...settings,
    categories: Array.isArray(settings.categories) ? settings.categories : DEFAULT_SETTINGS.categories,
    localAI: { ...DEFAULT_LOCAL_AI_SETTINGS, ...(settings.localAI || {}) },
    officeProfile: {
      ...DEFAULT_OFFICE_PROFILE,
      ...(settings.officeProfile || {}),
      authorizedSignatoryIds: Array.isArray(settings.officeProfile?.authorizedSignatoryIds) ? settings.officeProfile.authorizedSignatoryIds : [],
    },
  };
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings) {
  const existing = await db.settings.get(SETTINGS_ID);
  const now = new Date().toISOString();
  const workspaceChanged = JSON.stringify({ categories: existing?.categories, officeProfile: existing?.officeProfile }) !== JSON.stringify({ categories: settings.categories, officeProfile: settings.officeProfile });
  const userChanged = JSON.stringify(existing?.localAI) !== JSON.stringify(settings.localAI);
  const updated = {
    ...DEFAULT_SETTINGS,
    ...settings,
    localAI: { ...DEFAULT_LOCAL_AI_SETTINGS, ...(settings.localAI || {}) },
    officeProfile: {
      ...DEFAULT_OFFICE_PROFILE,
      ...(settings.officeProfile || {}),
      authorizedSignatoryIds: Array.isArray(settings.officeProfile?.authorizedSignatoryIds) ? settings.officeProfile.authorizedSignatoryIds : [],
    },
    id: SETTINGS_ID,
    workspaceSettingsUpdatedAt: workspaceChanged ? now : existing?.workspaceSettingsUpdatedAt || settings.workspaceSettingsUpdatedAt || '',
    userSettingsUpdatedAt: userChanged ? now : existing?.userSettingsUpdatedAt || settings.userSettingsUpdatedAt || '',
    updatedAt: now,
  };
  await db.settings.put(updated);
  return updated;
}
