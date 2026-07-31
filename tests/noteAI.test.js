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
    goal: 'Enable a decision on calling for comments.',
    proposedDirection: 'Comments may be requested within ten days.',
  });

  assert.match(NOTE_AI_SYSTEM_PROMPT, /Do not create a letter/);
  assert.match(NOTE_AI_SYSTEM_PROMPT, /never claim that consultation, discussion, approval or a decision occurred/);
  assert.match(NOTE_AI_SYSTEM_PROMPT, /Markdown headings/);
  assert.match(input, /Refine the existing note/);
  assert.match(input, /eReceipt 42/);
  assert.match(input, /EXISTING NOTE/);
  assert.match(input, /DECISION OR OUTCOME THIS NOTE SHOULD ENABLE/);
  assert.match(input, /Comments may be requested within ten days/);
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
    goal: 'Enable examination of the receipt.',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, 'draft');
  assert.equal(result.text, 'The receipt has been examined.');
  assert.equal(result.model, 'test-model');
});

test('noting AI requires a decision goal before first-note generation', async () => {
  await assert.rejects(
    () => generateOrRefineNote({
      provider: { id: 'unused', generateText: async () => ({ text: 'Unused' }) },
      operation: 'generate',
      issueContext: 'Recorded facts.',
    }),
    /what decision or outcome this note should enable/,
  );
});

test('noting AI removes report-style headings from weak model output', async () => {
  const result = await generateOrRefineNote({
    provider: {
      id: 'test-provider',
      async generateText() {
        return {
          text: '# SUBJECT: Calling for comments\n\n**FACTS:** The reference was received.\n\nPROPOSAL\n\nIt is proposed that comments may be called for.',
        };
      },
    },
    operation: 'generate',
    issueContext: 'Recorded facts.',
    goal: 'Enable a decision on calling for comments.',
  });

  assert.equal(result.text, 'Subject: Calling for comments\n\nThe reference was received.\n\nIt is proposed that comments may be called for.');
});
