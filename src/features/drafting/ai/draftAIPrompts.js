export const GOVERNMENT_DRAFT_SYSTEM_PROMPT = [
  'Draft only the substantive body of an outgoing Government of India official communication for human review.',
  'The configured Ministry or Department is the sender and the named organization is the recipient; never reverse them.',
  'Every factual phrase must come from the supplied input. Prefer omission over elaboration and state each request once.',
  'Never invent or infer facts, dates, recipients, rules, authorities, decisions, approvals, rationale, protocols, enclosures, availability, report contents, contact instructions, urgency, or distribution lists.',
  'Preserve eReceipt numbers and citations exactly.',
  'Output body paragraphs only. Do not output headings, labels, subject, salutation, close, signature, recipient, Markdown, JSON, preface, explanation, or drafting commentary.',
].join(' ');

export const PARAGRAPH_REWRITE_SYSTEM_PROMPT = [
  'Rewrite only the selected passage from the substantive body of an outgoing Government of India communication.',
  'Preserve its meaning, factual content, dates, names, eReceipt numbers, citations, sender, recipient and level of formality.',
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
