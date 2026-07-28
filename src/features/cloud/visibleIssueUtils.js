export function findInaccessibleLocalIssueIds({
  localIssues = [],
  visibleIssueIds = [],
  pendingSaveIssueIds = [],
  canEdit = false,
}) {
  const visibleIds = new Set(visibleIssueIds);
  const pendingIds = new Set(pendingSaveIssueIds);

  return localIssues
    .filter((issue) => {
      if (!issue?.id || issue.isDemo || visibleIds.has(issue.id)) return false;

      const isUnsyncedEditorIssue = (
        canEdit
        && pendingIds.has(issue.id)
        && Number(issue.cloudRevision || 0) === 0
      );
      return !isUnsyncedEditorIssue;
    })
    .map((issue) => issue.id);
}
