import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNoteParagraphDiff, buildNoteSuggestionReview } from '../src/features/noting/noteConversationUtils.js';

test('note comparison identifies retained, removed and added paragraphs', () => {
  const result = buildNoteParagraphDiff(
    'Subject: Matter\n\nRecorded background.\n\nOld conclusion.',
    'Subject: Matter\n\nRecorded background.\n\nReasoned examination.\n\nNew conclusion.',
  );

  assert.equal(result.unchanged, 2);
  assert.equal(result.removed, 1);
  assert.equal(result.added, 2);
  assert.deepEqual(result.changes.map((change) => change.type), [
    'unchanged', 'unchanged', 'removed', 'added', 'added',
  ]);
});

test('note comparison bounds unusually large notes', () => {
  const manyParagraphs = Array.from({ length: 250 }, (_, index) => `Paragraph ${index}`).join('\n\n');
  const result = buildNoteParagraphDiff(manyParagraphs, manyParagraphs);
  assert.equal(result.unchanged, 200);
});

test('note suggestion review groups replacements and resolves each decision', () => {
  const before = 'Background.\n\nOld reasoning.\n\nConclusion.';
  const after = 'Background.\n\nStronger reasoning.\n\nConclusion.\n\nProposed action.';
  const initial = buildNoteSuggestionReview(before, after);

  assert.equal(initial.groups.length, 2);
  assert.equal(initial.pending, 2);
  assert.deepEqual(initial.groups[0].removed, ['Old reasoning.']);
  assert.deepEqual(initial.groups[0].added, ['Stronger reasoning.']);
  assert.equal(initial.resolvedText, before);

  const resolved = buildNoteSuggestionReview(before, after, {
    [initial.groups[0].id]: 'accepted',
    [initial.groups[1].id]: 'rejected',
  });
  assert.equal(resolved.resolvedText, 'Background.\n\nStronger reasoning.\n\nConclusion.');
  assert.equal(resolved.accepted, 1);
  assert.equal(resolved.rejected, 1);
});
