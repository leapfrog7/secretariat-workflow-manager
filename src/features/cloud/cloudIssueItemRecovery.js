export function isMissingCloudIssueItemError(error) {
  return error?.code === 'P0001'
    && error?.message === 'Issue item no longer exists';
}

export function shouldRetryMissingCloudIssueItem(error, expectedRevision) {
  return Number(expectedRevision) > 0 && isMissingCloudIssueItemError(error);
}
