export function localWorkspaceScopeKey(workspaceId, userId) {
  return `${workspaceId}:${userId}`;
}

export function shouldResetLocalWorkspaceScope(currentScope, workspaceId, userId) {
  if (!workspaceId || !userId) return false;
  return currentScope !== localWorkspaceScopeKey(workspaceId, userId);
}
