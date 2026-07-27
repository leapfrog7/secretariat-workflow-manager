export function canEditWorkspace(profile, workspace) {
  if (!workspace) return false;
  return profile?.role === 'platform_admin'
    || ['workspace_admin', 'officer'].includes(workspace.membership?.role);
}

export function getDefaultOwningDivisionId({ divisions = [], memberships = [], userId = '' } = {}) {
  if (!userId) return '';
  const activeDivisionIds = new Set(divisions.filter((division) => division.is_active !== false).map((division) => division.id));
  const membershipsForUser = [...new Set(
    memberships
      .filter((membership) => membership.user_id === userId && membership.status === 'active' && activeDivisionIds.has(membership.division_id))
      .map((membership) => membership.division_id),
  )];
  return membershipsForUser.length === 1 ? membershipsForUser[0] : '';
}
