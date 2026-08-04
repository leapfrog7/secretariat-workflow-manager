import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dataSectionForIssueTab,
  loadedSectionsToRefresh,
  recordCountForIssueTab,
} from '../src/utils/issueWorkspaceLoading.js';

test('maps only record-heavy Issue tabs to deferred sections', () => {
  assert.equal(dataSectionForIssueTab('Current Position'), '');
  assert.equal(dataSectionForIssueTab('Running Summary'), '');
  assert.equal(dataSectionForIssueTab('Casework'), 'casework');
  assert.equal(dataSectionForIssueTab('References'), 'references');
  assert.equal(dataSectionForIssueTab('Record of Communication'), 'communications');
});

test('uses lightweight counts before deferred records are loaded', () => {
  const counts = { notes: 7, references: 3, communications: 12 };
  assert.equal(recordCountForIssueTab('Casework', counts, 4), 7);
  assert.equal(recordCountForIssueTab('References', counts, 4), 3);
  assert.equal(recordCountForIssueTab('Record of Communication', counts, 4), 12);
  assert.equal(recordCountForIssueTab('Running Summary', counts, 4), 4);
  assert.equal(recordCountForIssueTab('Share & Access', counts, 4), null);
});

test('refreshing loaded Casework avoids duplicate child-record requests', () => {
  assert.deepEqual(loadedSectionsToRefresh(new Set(['casework', 'references', 'communications'])), ['casework']);
  assert.deepEqual(loadedSectionsToRefresh(new Set(['references'])), ['references']);
  assert.deepEqual(loadedSectionsToRefresh(new Set(['communications', 'references'])), ['references', 'communications']);
});
