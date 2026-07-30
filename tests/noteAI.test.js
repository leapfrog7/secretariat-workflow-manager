import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNoteAIInput,
  generateOrRefineNote,
  NOTE_AI_SYSTEM_PROMPT,
} from '../src/features/noting/noteAI.js';

test('noting AI uses a separate Government note contract', () => {
  const input = buildNoteAIInput({
    operation: 'refine',
    issueContext: 'eReceipt 42 was received on 28 July 2026.',
    currentNote: 'Receipt may be examined.',
    instruction: 'Retain the date.',
  });

  assert.match(NOTE_AI_SYSTEM_PROMPT, /Do not create a letter/);
  assert.match(NOTE_AI_SYSTEM_PROMPT, /avoid claiming that approval/);
  assert.match(input, /Refine the existing note/);
  assert.match(input, /eReceipt 42/);
  assert.match(input, /EXISTING NOTE/);
});

test('noting AI returns reviewable text without saving it', async () => {
  const calls = [];
  const result = await generateOrRefineNote({
    provider: {
      id: 'test-provider',
      async generateText(request) {
        calls.push(request);
        return { text: '```text\nThe receipt has been examined.\n```', model: 'test-model' };
      },
    },
    operation: 'generate',
    issueContext: 'Recorded facts.',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, 'draft');
  assert.equal(result.text, 'The receipt has been examined.');
  assert.equal(result.model, 'test-model');
});
