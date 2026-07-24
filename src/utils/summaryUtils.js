export const SUMMARY_FIELDS = ['content'];

const LEGACY_SUMMARY_SECTIONS = [
  ['overview', 'What this Issue is about'],
  ['keyFacts', 'Important facts and background'],
  ['presentPosition', 'Present position'],
  ['outstandingDecisions', 'Decisions or questions outstanding'],
  ['nextStep', 'Immediate next step'],
];

function legacyContent(input) {
  return LEGACY_SUMMARY_SECTIONS
    .filter(([field]) => String(input[field] || '').trim())
    .map(([field, label]) => `## ${label}\n${String(input[field]).trim()}`)
    .join('\n\n');
}

export function normalizeIssueSummary(input = {}) {
  return {
    id: input.id,
    issueId: input.issueId || '',
    version: Number(input.version) || 0,
    content: String(input.content || '').trim() || legacyContent(input),
    overview: input.overview || '',
    keyFacts: input.keyFacts || '',
    presentPosition: input.presentPosition || '',
    outstandingDecisions: input.outstandingDecisions || '',
    nextStep: input.nextStep || '',
    createdAt: input.createdAt,
  };
}

export function validateIssueSummary(summary) {
  if (summary?.content?.trim()) return {};
  return { summary: 'Add some text to the running summary.' };
}

export function summariesMatch(a, b) {
  return SUMMARY_FIELDS.every((field) => (a?.[field] || '').trim() === (b?.[field] || '').trim());
}
