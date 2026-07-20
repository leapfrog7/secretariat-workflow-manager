export const SUMMARY_FIELDS = [
  'overview',
  'keyFacts',
  'presentPosition',
  'outstandingDecisions',
  'nextStep',
];

export function normalizeIssueSummary(input = {}) {
  return {
    id: input.id,
    issueId: input.issueId || '',
    version: Number(input.version) || 0,
    overview: input.overview || '',
    keyFacts: input.keyFacts || '',
    presentPosition: input.presentPosition || '',
    outstandingDecisions: input.outstandingDecisions || '',
    nextStep: input.nextStep || '',
    createdAt: input.createdAt,
  };
}

export function validateIssueSummary(summary) {
  if (SUMMARY_FIELDS.some((field) => summary[field]?.trim())) return {};
  return { summary: 'Add information to at least one section.' };
}

export function summariesMatch(a, b) {
  return SUMMARY_FIELDS.every((field) => (a?.[field] || '').trim() === (b?.[field] || '').trim());
}
