import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRunningSummarySystemPrompt,
  normalizeRunningSummaryDetail,
  runningSummaryOutputTokens,
  RUNNING_SUMMARY_DETAIL_OPTIONS,
} from '../src/utils/runningSummaryAI.js';

test('running summaries offer bounded brief, standard and detailed levels', () => {
  assert.deepEqual(RUNNING_SUMMARY_DETAIL_OPTIONS.map((option) => option.value), ['brief', 'standard', 'detailed']);
  assert.equal(normalizeRunningSummaryDetail('unknown'), 'standard');
  assert.ok(runningSummaryOutputTokens('brief') < runningSummaryOutputTokens('standard'));
  assert.ok(runningSummaryOutputTokens('standard') < runningSummaryOutputTokens('detailed'));
});

test('every running-summary prompt retains common factual safeguards', () => {
  for (const detail of ['brief', 'standard', 'detailed']) {
    const prompt = buildRunningSummarySystemPrompt(detail);
    assert.match(prompt, /never invent facts/i);
    assert.match(prompt, /distinguish an approved decision.*from a proposal/i);
    assert.match(prompt, /present position/i);
    assert.match(prompt, /pending action/i);
    assert.match(prompt, /Return only the summary in Markdown/i);
  }
});

test('summary detail changes depth without forcing artificial length', () => {
  assert.match(buildRunningSummarySystemPrompt('brief'), /100 to 250 words/);
  assert.match(buildRunningSummarySystemPrompt('standard'), /300 to 700 words/);
  assert.match(buildRunningSummarySystemPrompt('detailed'), /700 to 1,500 words/);
  assert.match(buildRunningSummarySystemPrompt('detailed'), /Do not pad a simple matter/i);
});

test('running-summary UI sends the selected level to either provider', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/components/issues/RunningSummaryPanel.jsx', import.meta.url), 'utf8'));
  assert.match(source, /label="Summary detail"/);
  assert.match(source, /detail: summaryDetail/);
  assert.match(source, /sm:grid-cols-\[auto_minmax\(13rem,1fr\)_auto\]/);
});
