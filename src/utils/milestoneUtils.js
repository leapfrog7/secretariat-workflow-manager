export function normalizeMilestone(input = {}) {
  return {
    id: input.id,
    issueId: input.issueId || '',
    status: input.status || 'Pending',
    assignedOfficerId: input.assignedOfficerId || '',
    assignedOfficerName: input.assignedOfficerName || '',
    note: input.note || '',
    recordedAt: input.recordedAt || input.createdAt || new Date().toISOString(),
    createdAt: input.createdAt || input.recordedAt || new Date().toISOString(),
  };
}
