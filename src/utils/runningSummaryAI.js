export const RUNNING_SUMMARY_DETAIL_OPTIONS = [
  { value: 'brief', label: 'Brief', description: 'Present position, key decision and immediate pending action.', maxOutputTokens: 700 },
  { value: 'standard', label: 'Standard', description: 'Balanced chronology, decisions, deadlines and pending work.', maxOutputTokens: 1400 },
  { value: 'detailed', label: 'Detailed', description: 'Fuller background, reasoning, rules, stakeholder positions and unresolved matters.', maxOutputTokens: 2600 },
];

const DETAIL_GUIDANCE = {
  brief: 'Prepare a brief summary, normally 100 to 250 words in one to three short paragraphs. Retain only the present position, the key decision or direction, and the immediate pending action with responsibility and deadline where recorded. Do not add headings unless essential.',
  standard: 'Prepare a balanced summary, normally 300 to 700 words. Cover the material background and chronology, decisions or directions, deadlines, responsibility, present position and next required action. Use short descriptive headings only when they improve navigation.',
  detailed: 'Prepare a detailed summary, normally 700 to 1,500 words where the source material warrants it. Preserve material background, chronology, reasoning, rule or policy references, stakeholder positions, decisions or directions, unresolved questions, present position and next required action. Do not pad a simple matter merely to reach the indicative length.',
};

export function normalizeRunningSummaryDetail(value) {
  return RUNNING_SUMMARY_DETAIL_OPTIONS.some((option) => option.value === value) ? value : 'standard';
}

export function runningSummaryOutputTokens(value) {
  const detail = normalizeRunningSummaryDetail(value);
  return RUNNING_SUMMARY_DETAIL_OPTIONS.find((option) => option.value === detail).maxOutputTokens;
}

export function buildRunningSummarySystemPrompt(value = 'standard') {
  const detail = normalizeRunningSummaryDetail(value);
  return [
    'Convert the supplied official notes into a factual running summary for Government work.',
    'Preserve material dates, names, file or eReceipt numbers, decisions, directions, rule citations, deadlines, pending actions and responsibility. Clearly distinguish an approved decision or completed action from a proposal, recommendation, discussion or matter awaiting approval. Preserve explicit uncertainty and gaps in the record; never invent facts, infer an approval or resolve uncertainty.',
    'Remove repetition, drafting discussion and immaterial detail. Organize the account in the natural sequence of background, material developments, decisions or directions, present position and pending action, but do not force headings for sections that have no material content.',
    DETAIL_GUIDANCE[detail],
    'Use short readable paragraphs. Use bullets for distinct actions or issues, and Markdown tables only when dates, responsibilities or status are genuinely clearer in a table. Return only the summary in Markdown.',
  ].join(' ');
}

export const RUNNING_SUMMARY_SYSTEM_PROMPT = buildRunningSummarySystemPrompt('standard');
