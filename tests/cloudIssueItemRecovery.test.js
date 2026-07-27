import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMissingCloudIssueItemError,
  shouldRetryMissingCloudIssueItem,
} from '../src/features/cloud/cloudIssueItemRecovery.js';

test('recognizes the precise missing Issue item response from the revision RPC', () => {
  assert.equal(isMissingCloudIssueItemError({
    code: 'P0001',
    message: 'Issue item no longer exists',
  }), true);
});

test('does not treat permission or unrelated database errors as a missing row', () => {
  assert.equal(isMissingCloudIssueItemError({
    code: 'P0001',
    message: 'Issue editing access required',
  }), false);
  assert.equal(isMissingCloudIssueItemError({
    code: '23503',
    message: 'Foreign key violation',
  }), false);
});

test('retries only stale saves and never loops a failed create', () => {
  const missing = { code: 'P0001', message: 'Issue item no longer exists' };
  assert.equal(shouldRetryMissingCloudIssueItem(missing, 4), true);
  assert.equal(shouldRetryMissingCloudIssueItem(missing, 0), false);
});
