import { db } from './database';
import { normalizeMilestone } from '../utils/milestoneUtils';

export async function getMilestonesByIssue(issueId, { limit } = {}) {
  const milestones = (await db.issueMilestones.where('issueId').equals(issueId).toArray())
    .map(normalizeMilestone)
    .sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0));
  return Number.isInteger(limit) ? milestones.slice(0, limit) : milestones;
}

export async function countMilestonesByIssue(issueId) {
  return db.issueMilestones.where('issueId').equals(issueId).count();
}
