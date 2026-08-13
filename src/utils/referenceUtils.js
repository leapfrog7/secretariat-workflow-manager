export function normalizeReference(input = {}) {
  return {
    id: input.id,
    issueId: input.issueId || '',
    citation: input.citation || '',
    referenceDate: input.referenceDate || '',
    notes: input.notes || '',
    libraryReferenceId: input.libraryReferenceId || input.reference?.id || '',
    reference: input.reference || null,
    link: input.link || null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    cloudRevision: Number(input.cloudRevision) || 0,
    cloudUpdatedAt: input.cloudUpdatedAt || '',
    cloudUpdatedBy: input.cloudUpdatedBy || '',
  };
}

export function normalizeWorkspaceReference(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || crypto.randomUUID(),
    title: input.title || input.citation || '',
    citation: input.citation || input.title || '',
    referenceDate: input.referenceDate || '',
    authority: input.authority || '',
    referenceType: input.referenceType || 'Other',
    tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : [],
    sourceName: input.sourceName || '',
    sourceType: input.sourceType || '',
    retainedText: input.retainedText || input.content || '',
    extracts: Array.isArray(input.extracts) ? input.extracts.map(normalizeReferenceExtract) : [],
    scope: input.scope === 'personal' ? 'personal' : 'workspace',
    ownerUserId: input.ownerUserId || '',
    status: input.status === 'archived' ? 'archived' : 'active',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    cloudRevision: Number(input.cloudRevision) || 0,
    cloudUpdatedAt: input.cloudUpdatedAt || '',
    cloudUpdatedBy: input.cloudUpdatedBy || '',
    cloudPending: Boolean(input.cloudPending),
  };
}

export function normalizeReferenceExtract(input = {}) {
  return {
    id: input.id || crypto.randomUUID(),
    title: input.title || 'Relevant extract',
    content: String(input.content || '').trim(),
    pageLabel: input.pageLabel || '',
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function normalizeIssueReferenceLink(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || crypto.randomUUID(),
    issueId: input.issueId || '',
    referenceId: input.referenceId || '',
    extractIds: Array.isArray(input.extractIds) ? input.extractIds.filter(Boolean) : [],
    relevanceNote: input.relevanceNote || input.notes || '',
    includeFullText: Boolean(input.includeFullText),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    cloudRevision: Number(input.cloudRevision) || 0,
    cloudPending: Boolean(input.cloudPending),
  };
}

export function validateWorkspaceReference(reference) {
  const errors = {};
  if (!reference.title?.trim()) errors.title = 'Title is required.';
  if (reference.retainedText && new TextEncoder().encode(reference.retainedText).byteLength > 2 * 1024 * 1024) {
    errors.retainedText = 'Retained text must be below 2 MB. Save only the relevant pages or extracts.';
  }
  return errors;
}

export function validateReference(reference) {
  const errors = {};
  if (!reference.citation?.trim()) errors.citation = 'Reference is required.';
  return errors;
}
