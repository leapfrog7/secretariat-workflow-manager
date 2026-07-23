import { db } from './database';
import { normalizeOfficer } from '../utils/officerUtils';
import { getOfficerIdentityKey } from '../utils/officerIdentity';

function time(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function replaceId(value, replacements) {
  return replacements.get(value) || value || '';
}

function replaceHistoryIds(items, fields, replacements) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    const updated = { ...item };
    fields.forEach((field) => {
      updated[field] = replaceId(updated[field], replacements);
    });
    return updated;
  });
}

export async function consolidateDuplicateOfficers({ preferredIds = new Set() } = {}) {
  const rows = (await db.officers.toArray()).map(normalizeOfficer);
  const groups = new Map();
  rows.forEach((officer) => {
    const key = getOfficerIdentityKey(officer);
    if (!key || !officer.name.trim()) return;
    groups.set(key, [...(groups.get(key) || []), officer]);
  });

  const replacements = new Map();
  const canonicalById = new Map();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => {
      const preferred = Number(preferredIds.has(b.id)) - Number(preferredIds.has(a.id));
      return preferred || time(a.createdAt) - time(b.createdAt) || String(a.id).localeCompare(String(b.id));
    });
    const canonical = ordered[0];
    ordered.slice(1).forEach((duplicate) => {
      replacements.set(duplicate.id, canonical.id);
      canonicalById.set(duplicate.id, canonical);
    });
  }

  if (!replacements.size) {
    return { officers: rows, idMap: {}, duplicateIds: [], updatedReferences: 0 };
  }

  const now = new Date().toISOString();
  let updatedReferences = 0;
  await db.transaction(
    'rw',
    db.officers,
    db.issues,
    db.actions,
    db.communications,
    db.issueMilestones,
    db.drafts,
    db.settings,
    async () => {
      await db.issues.toCollection().modify((issue) => {
        const assignedOfficerId = replaceId(issue.assignedOfficerId, replacements);
        if (assignedOfficerId !== issue.assignedOfficerId) {
          issue.assignedOfficerId = assignedOfficerId;
          issue.updatedAt = now;
          updatedReferences += 1;
        }
      });

      await db.actions.toCollection().modify((action) => {
        const before = JSON.stringify(action);
        action.assignedOfficerId = replaceId(action.assignedOfficerId, replacements);
        action.assignedByOfficerId = replaceId(action.assignedByOfficerId, replacements);
        action.reviewedByOfficerId = replaceId(action.reviewedByOfficerId, replacements);
        action.assignmentHistory = replaceHistoryIds(action.assignmentHistory, ['previousOfficerId', 'newOfficerId', 'assignedByOfficerId'], replacements);
        action.progressHistory = replaceHistoryIds(action.progressHistory, ['updatedByOfficerId'], replacements);
        action.submissionHistory = replaceHistoryIds(action.submissionHistory, ['submittedByOfficerId'], replacements);
        action.reviewHistory = replaceHistoryIds(action.reviewHistory, ['reviewedByOfficerId'], replacements);
        if (JSON.stringify(action) !== before) {
          action.updatedAt = now;
          updatedReferences += 1;
        }
      });

      await db.communications.toCollection().modify((communication) => {
        const signatoryId = replaceId(communication.signatoryId, replacements);
        if (signatoryId !== communication.signatoryId) {
          communication.signatoryId = signatoryId;
          communication.updatedAt = now;
          updatedReferences += 1;
        }
      });

      await db.drafts.toCollection().modify((draft) => {
        const signatoryId = replaceId(draft.signatoryId, replacements);
        if (signatoryId !== draft.signatoryId) {
          draft.signatoryId = signatoryId;
          draft.updatedAt = now;
          updatedReferences += 1;
        }
      });

      await db.issueMilestones.toCollection().modify((milestone) => {
        const previousOfficerId = milestone.assignedOfficerId;
        const assignedOfficerId = replaceId(milestone.assignedOfficerId, replacements);
        if (assignedOfficerId !== milestone.assignedOfficerId) {
          milestone.assignedOfficerId = assignedOfficerId;
          milestone.assignedOfficerName = canonicalById.get(previousOfficerId)?.name || milestone.assignedOfficerName;
          milestone.updatedAt = now;
          updatedReferences += 1;
        }
      });

      await db.settings.toCollection().modify((settings) => {
        const selected = settings.officeProfile?.authorizedSignatoryIds;
        if (!Array.isArray(selected)) return;
        const authorizedSignatoryIds = [...new Set(selected.map((id) => replaceId(id, replacements)))];
        if (JSON.stringify(authorizedSignatoryIds) !== JSON.stringify(selected)) {
          settings.officeProfile = { ...settings.officeProfile, authorizedSignatoryIds };
          settings.workspaceSettingsUpdatedAt = now;
          settings.updatedAt = now;
          updatedReferences += 1;
        }
      });

      await db.officers.bulkDelete([...replacements.keys()]);
    },
  );

  return {
    officers: (await db.officers.toArray()).map(normalizeOfficer),
    idMap: Object.fromEntries(replacements),
    duplicateIds: [...replacements.keys()],
    updatedReferences,
  };
}
