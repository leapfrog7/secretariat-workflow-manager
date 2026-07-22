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
