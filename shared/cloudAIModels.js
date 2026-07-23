export const DEFAULT_GEMINI_TASK_LEVEL = 'moderate';

export const GEMINI_TASK_LEVELS = [
  {
    id: 'simple',
    label: 'Simple',
    description: 'Short, routine drafts and straightforward rewrites.',
    model: 'gemini-2.5-flash-lite',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    description: 'Most official drafting, summaries and structured replies.',
    model: 'gemini-2.5-flash',
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Complex reasoning, competing references and sensitive drafting.',
    model: 'gemini-2.5-pro',
  },
];

export function normalizeGeminiTaskLevel(value) {
  return GEMINI_TASK_LEVELS.some((level) => level.id === value) ? value : DEFAULT_GEMINI_TASK_LEVEL;
}

export function getGeminiTaskLevel(value) {
  const normalized = normalizeGeminiTaskLevel(value);
  return GEMINI_TASK_LEVELS.find((level) => level.id === normalized);
}
