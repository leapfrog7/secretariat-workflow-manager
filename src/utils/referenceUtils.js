export function normalizeReference(input = {}) {
  return {
    id: input.id,
    issueId: input.issueId || '',
    citation: input.citation || '',
    referenceDate: input.referenceDate || '',
    notes: input.notes || '',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function validateReference(reference) {
  const errors = {};
  if (!reference.citation?.trim()) errors.citation = 'Reference is required.';
  return errors;
}
