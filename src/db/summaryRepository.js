import { db } from './database';
import { normalizeIssueSummary, summariesMatch, validateIssueSummary } from '../utils/summaryUtils';
import { queueCloudIssueItemDelete, queueCloudIssueItemUpsert } from '../features/cloud/cloudIssueItemSync';

export async function getSummaryVersions(issueId) {
  const summaries = await db.issueSummaries.where('issueId').equals(issueId).toArray();
  return summaries
    .map(normalizeIssueSummary)
    .sort((a, b) => b.version - a.version || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function getLatestSummary(issueId) {
  const summaries = await getSummaryVersions(issueId);
  return summaries[0] || null;
}

export async function countSummaryVersions(issueId) {
  return db.issueSummaries.where('issueId').equals(issueId).count();
}

export async function saveSummaryVersion(input) {
  const result = await db.transaction('rw', db.issueSummaries, async () => {
    const latest = await getLatestSummary(input.issueId);
    const summary = normalizeIssueSummary({
      ...input,
      id: crypto.randomUUID(),
      version: (latest?.version || 0) + 1,
      createdAt: new Date().toISOString(),
    });
    const errors = validateIssueSummary(summary);
    if (Object.keys(errors).length) {
      const error = new Error(errors.summary);
      error.validationErrors = errors;
      throw error;
    }
    if (latest && summariesMatch(latest, summary)) return latest;
    await db.issueSummaries.add(summary);
    return summary;
  });
  queueCloudIssueItemUpsert('summary', result);
  return result;
}

export async function deleteSummaryVersion(id) {
  const summary = await db.issueSummaries.get(id);
  if (!summary) return false;
  await db.issueSummaries.delete(id);
  queueCloudIssueItemDelete('summary', id);
  return true;
}
