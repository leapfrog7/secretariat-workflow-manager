export const CLOUD_SEARCH_THRESHOLD = 100;

function searchableText(issue) {
  return [issue.shortTitle, issue.eFileNumber, issue.subjectType, issue.currentPosition, issue.status]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

export function searchLocalCaseworkIssues(issues, query = '', { limit = 20, offset = 0 } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matching = normalizedQuery
    ? issues.filter((issue) => searchableText(issue).includes(normalizedQuery))
    : issues;
  return {
    items: matching.slice(offset, offset + limit),
    total: matching.length,
  };
}

export function shouldUseCloudCaseworkSearch({ mode, workspaceId, issueCount }) {
  return mode === 'cloud' && Boolean(workspaceId) && issueCount > CLOUD_SEARCH_THRESHOLD;
}
