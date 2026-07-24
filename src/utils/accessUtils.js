export function canEditWorkspace(profile, workspace) {
  if (!workspace) return false;
  return profile?.role === 'platform_admin' || workspace.membership?.role !== 'viewer';
}
