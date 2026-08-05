import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLOUD_SEARCH_THRESHOLD,
  searchLocalCaseworkIssues,
  shouldUseCloudCaseworkSearch,
} from '../src/features/casework/caseworkSearch.js';

const issues = [
  { id: '1', shortTitle: 'Audit response', eFileNumber: 'A-12', status: 'Pending', currentPosition: 'Comments awaited' },
  { id: '2', shortTitle: 'Parliament question', eFileNumber: 'P-9', status: 'Awaiting Discussion', currentPosition: 'Brief prepared' },
  { id: '3', shortTitle: 'Procurement proposal', eFileNumber: 'F-22', status: 'In Progress', currentPosition: 'Finance concurrence sought' },
];

test('local Casework search covers title, eFile, stage and present position', () => {
  assert.deepEqual(searchLocalCaseworkIssues(issues, 'audit').items.map((item) => item.id), ['1']);
  assert.deepEqual(searchLocalCaseworkIssues(issues, 'P-9').items.map((item) => item.id), ['2']);
  assert.deepEqual(searchLocalCaseworkIssues(issues, 'concurrence').items.map((item) => item.id), ['3']);
  assert.deepEqual(searchLocalCaseworkIssues(issues, 'awaiting discussion').items.map((item) => item.id), ['2']);
});

test('local Casework search returns bounded pages', () => {
  const page = searchLocalCaseworkIssues(issues, '', { limit: 1, offset: 1 });
  assert.equal(page.total, 3);
  assert.deepEqual(page.items.map((item) => item.id), ['2']);
});

test('large authenticated workspaces use cloud search while local and small workspaces do not', () => {
  assert.equal(shouldUseCloudCaseworkSearch({ mode: 'cloud', workspaceId: 'workspace', issueCount: CLOUD_SEARCH_THRESHOLD + 1 }), true);
  assert.equal(shouldUseCloudCaseworkSearch({ mode: 'cloud', workspaceId: 'workspace', issueCount: CLOUD_SEARCH_THRESHOLD }), false);
  assert.equal(shouldUseCloudCaseworkSearch({ mode: 'local', workspaceId: '', issueCount: 1000 }), false);
});
