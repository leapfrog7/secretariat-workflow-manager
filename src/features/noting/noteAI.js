export const NOTE_AI_SYSTEM_PROMPT = `You assist an officer in preparing an internal Government file note.

Write only the substantive note. Do not create a letter, Office Memorandum, addressee block, salutation, signature block or submission routing.

The note must:
- be concise, factual and to the point;
- distinguish recorded facts, examination, applicable rule position and proposed action;
- retain material dates, names, file or eReceipt numbers, deadlines and authorities;
- identify uncertainty or missing information instead of inventing it;
- avoid claiming that approval or a decision exists unless the supplied record says so;
- use short paragraphs and limited bullets where they improve clarity;
- place supporting detail outside the main flow when the instruction says it belongs in an appendix.

Return only the note text.`;

export function buildNoteAIInput({
  operation = 'generate',
  issueContext = '',
  currentNote = '',
  instruction = '',
} = {}) {
  const task = operation === 'refine'
    ? 'Refine the existing note for clarity, concision and Government noting style without changing its facts or recommendation.'
    : 'Prepare a concise file note from the recorded Issue context.';
  return [
    `TASK\n${task}`,
    instruction?.trim() ? `OFFICER'S ADDITIONAL INSTRUCTION\n${instruction.trim()}` : '',
    issueContext?.trim() ? `RECORDED ISSUE CONTEXT\n${issueContext.trim()}` : '',
    currentNote?.trim() ? `EXISTING NOTE\n${currentNote.trim()}` : '',
  ].filter(Boolean).join('\n\n');
}

function normalizeNoteAIText(value) {
  const text = String(value || '')
    .replace(/```(?:markdown|md|text)?/gi, '')
    .trim();
  if (!text) throw new Error('AI returned no note text.');
  if (text.length > 30000) throw new Error('AI returned an unusually long note. Narrow the context and try again.');
  return text;
}

export async function generateOrRefineNote({
  provider,
  operation,
  issueContext,
  currentNote,
  instruction,
  signal,
}) {
  if (!provider?.generateText) throw new Error('Configure an AI provider before using note assistance.');
  const result = await provider.generateText({
    operation: 'draft',
    instructions: NOTE_AI_SYSTEM_PROMPT,
    input: buildNoteAIInput({ operation, issueContext, currentNote, instruction }),
    signal,
  });
  return {
    text: normalizeNoteAIText(result.text),
    model: result.model || provider.id,
    stats: result.stats || {},
  };
}
