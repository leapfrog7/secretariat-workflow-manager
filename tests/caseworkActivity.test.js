import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecentCaseworkActivity } from '../src/features/casework/caseworkActivity.js';

test('recent Casework uses the newest saved Note or Draft per visible Issue', () => {
  const issues = [{ id: 'one', shortTitle: 'One' }, { id: 'two', shortTitle: 'Two' }];
  const notes = [
    { id: 'note-1', issueId: 'one', updatedAt: '2026-01-02T10:00:00Z' },
    { id: 'note-2', issueId: 'two', updatedAt: '2026-01-03T10:00:00Z' },
  ];
  const drafts = [
    { id: 'draft-1', issueId: 'one', updatedAt: '2026-01-04T10:00:00Z' },
    { id: 'hidden', issueId: 'not-visible', updatedAt: '2026-01-05T10:00:00Z' },
  ];

  const activity = buildRecentCaseworkActivity(issues, notes, drafts);
  assert.deepEqual(activity.map((item) => item.issue.id), ['one', 'two']);
  assert.equal(activity[0].activityKind, 'draft');
  assert.equal(activity[0].latestNote.id, 'note-1');
  assert.equal(activity[0].latestDraft.id, 'draft-1');
});

test('recent Casework remains bounded and excludes Issues without saved work', () => {
  const issues = Array.from({ length: 8 }, (_, index) => ({ id: String(index), shortTitle: String(index) }));
  const notes = issues.map((issue, index) => ({ id: `n-${issue.id}`, issueId: issue.id, updatedAt: `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00Z` }));
  const activity = buildRecentCaseworkActivity(issues, notes, [], 3);
  assert.deepEqual(activity.map((item) => item.issue.id), ['7', '6', '5']);
});
