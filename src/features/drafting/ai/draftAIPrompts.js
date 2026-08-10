export const GOVERNMENT_DRAFT_SYSTEM_PROMPT = [
  'Draft only the substantive body of an outgoing Government of India official communication for human review.',
  'The configured Ministry or Department is the sender and the named organization is the recipient; never reverse them.',
  'Use clear, concise, professional language incapable of misconstruction. Avoid lengthy sentences, abruptness, redundancy, circumlocution, superlatives and repetition.',
  'Follow the supplied form-specific rule exactly: Letters and D.O. Letters use the required first-person voice, while Office Memoranda, Office Orders, Orders and I.D. Notes use third-person institutional or operative voice.',
  'When selected file Notes are supplied, use their examination and proposal as the primary drafting direction. Do not describe a proposal as approved or decided unless the record expressly says so.',
  'Every factual phrase must come from the supplied input. Prefer omission over elaboration and state each request once.',
  'Never invent or infer facts, dates, recipients, rules, authorities, decisions, approvals, rationale, protocols, enclosures, availability, report contents, contact instructions, urgency, or distribution lists.',
  'Preserve eReceipt numbers and citations exactly.',
  'Output body paragraphs only. Do not output headings, labels, subject, salutation, close, signature, recipient, Markdown, JSON, preface, explanation, or drafting commentary.',
].join(' ');

export const DRAFT_CONTENT_LENGTHS = [
  { value: 'single_paragraph', label: 'One concise paragraph', description: 'State only the essential communication or request.' },
  { value: 'short', label: 'Short: 2–3 paragraphs', description: 'Brief context, purpose and requested action.' },
  { value: 'standard', label: 'Standard: 4–6 paragraphs', description: 'Enough background and reasoning for a self-contained communication.' },
  { value: 'detailed', label: 'Detailed: 1–2 pages', description: 'Set out material background, reasoning and the required course.' },
  { value: 'extended', label: 'Extended: 3–4 pages', description: 'For communications that must carry substantial examination or reasons.' },
  { value: 'as_required', label: 'As required by complexity', description: 'Use no more content than the record and purpose genuinely require.' },
];

export const DRAFT_PARAGRAPH_STYLES = [
  { value: 'compact', label: 'Compact paragraphs', description: 'Short, direct paragraphs with one main point each.' },
  { value: 'balanced', label: 'Balanced paragraphs', description: 'Moderate paragraphs suitable for most official communications.' },
  { value: 'developed', label: 'Developed reasoning', description: 'Longer connected paragraphs where reasoning needs fuller explanation.' },
  { value: 'numbered', label: 'Numbered paragraphs', description: 'Separate the substantive body into numbered paragraphs.' },
];

export function draftContentGuidance(contentLength = 'short', paragraphStyle = 'balanced') {
  const length = DRAFT_CONTENT_LENGTHS.find((option) => option.value === contentLength) || DRAFT_CONTENT_LENGTHS[1];
  const style = DRAFT_PARAGRAPH_STYLES.find((option) => option.value === paragraphStyle) || DRAFT_PARAGRAPH_STYLES[1];
  return `BODY LENGTH AND DEVELOPMENT\n${length.label}. ${length.description}\n\nPARAGRAPH STYLE\n${style.label}. ${style.description} The requested extent applies only to the substantive body. Do not pad, repeat, or invent material to reach it.`;
}

export function draftContentTaskLevel(contentLength) {
  if (contentLength === 'single_paragraph' || contentLength === 'short') return 'simple';
  if (contentLength === 'standard') return 'moderate';
  return 'hard';
}

export function draftContentOutputTokens(contentLength) {
  if (contentLength === 'single_paragraph') return 700;
  if (contentLength === 'short') return 1200;
  if (contentLength === 'standard') return 1800;
  if (contentLength === 'detailed') return 3000;
  return 4000;
}

export const PARAGRAPH_REWRITE_SYSTEM_PROMPT = [
  'Rewrite only the selected passage from the substantive body of an outgoing Government of India communication.',
  'Preserve its meaning, factual content, dates, names, eReceipt numbers, citations, sender, recipient and level of formality.',
  'Preserve the communication type\'s required first-person or third-person voice.',
  'Do not add facts, headings, subjects, signatures, recipient blocks, explanations, Markdown, JSON or surrounding paragraphs.',
  'Return only the replacement passage.',
].join(' ');

export function buildParagraphRewriteInput({
  communicationType,
  body,
  selectedText,
  instruction,
  context,
}) {
  return [
    `COMMUNICATION TYPE\n${communicationType}`,
    `SUBSTANTIVE BODY FOR CONTEXT\n${body}`,
    `SELECTED BODY PASSAGE TO REWRITE\n${selectedText}`,
    `ORIGINAL DRAFTING BRIEF\n${instruction || 'No additional brief.'}`,
    `RELEVANT ISSUE CONTEXT\n${context || 'No additional context supplied.'}`,
  ].join('\n\n');
}
