import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findInaccessibleLocalIssueIds } from '../src/features/cloud/visibleIssueUtils.js';

test('viewers purge every non-visible cloud Issue, including pending local copies', () => {
  const result = findInaccessibleLocalIssueIds({
    localIssues: [
      { id: 'visible', cloudRevision: 2 },
      { id: 'revoked', cloudRevision: 2 },
      { id: 'pending', cloudRevision: 0 },
    ],
    visibleIssueIds: ['visible'],
    pendingSaveIssueIds: ['pending'],
    canEdit: false,
  });

  assert.deepEqual(result, ['revoked', 'pending']);
});

test('editors retain only genuinely new pending Issues that have never reached cloud', () => {
  const result = findInaccessibleLocalIssueIds({
    localIssues: [
      { id: 'new', cloudRevision: 0 },
      { id: 'revoked', cloudRevision: 4 },
      { id: 'orphan', cloudRevision: 0 },
    ],
    pendingSaveIssueIds: ['new', 'revoked'],
    canEdit: true,
  });

  assert.deepEqual(result, ['revoked', 'orphan']);
});

test('demo Issues are outside cloud visibility purging', () => {
  const result = findInaccessibleLocalIssueIds({
    localIssues: [{ id: 'demo', isDemo: true }],
    canEdit: false,
  });

  assert.deepEqual(result, []);
});
