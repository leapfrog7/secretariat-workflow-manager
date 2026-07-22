export function normalizeDraft(input = {}) {
  return {
    id: input.id,
    issueId: input.issueId || '',
    version: Number(input.version) || 0,
    status: input.status || 'Working',
    communicationType: input.communicationType || '',
    signatoryId: input.signatoryId || '',
    signatoryName: input.signatoryName || '',
    recipientRelationship: input.recipientRelationship || '',
    recipient: input.recipient && typeof input.recipient === 'object' ? input.recipient : {},
    documentDetails: input.documentDetails && typeof input.documentDetails === 'object' ? input.documentDetails : {},
    instruction: input.instruction || '',
    content: input.content || '',
    model: input.model || '',
    selectedCommunicationIds: Array.isArray(input.selectedCommunicationIds) ? input.selectedCommunicationIds : [],
    selectedReferenceIds: Array.isArray(input.selectedReferenceIds) ? input.selectedReferenceIds : [],
    createdAt: input.createdAt,
    updatedAt: input.updatedAt || input.createdAt,
  };
}

export function validateDraft(draft) {
  const errors = {};
  if (!draft.issueId) errors.issueId = 'Issue is required.';
  if (!draft.content.trim()) errors.content = 'Draft content is required.';
  return errors;
}

export function planDraftStorage(drafts, maximum = 5) {
  const ordered = drafts.map(normalizeDraft).sort((a, b) => a.version - b.version || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  const overwrite = ordered.length >= maximum ? ordered[0] : null;
  const newestToKeep = new Set(ordered.slice(-(maximum - 1)).map((item) => item.id));
  return {
    nextVersion: Math.max(0, ...ordered.map((item) => Number(item.version) || 0)) + 1,
    overwrite,
    deletedIds: overwrite ? ordered.filter((item) => item.id !== overwrite.id && !newestToKeep.has(item.id)).map((item) => item.id) : [],
  };
}
