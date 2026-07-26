import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudPayloadsMatch } from '../src/features/cloud/cloudPayloadUtils.js';

test('sync metadata and local timestamps do not create material differences', () => {
  assert.equal(
    cloudPayloadsMatch(
      {
        id: 'issue-1',
        shortTitle: 'Budget review',
        status: 'Pending',
        updatedAt: '2026-07-26T10:00:00.000Z',
        cloudRevision: 2,
        cloudUpdatedAt: '2026-07-26T10:00:01.000Z',
        accessLevel: 'editor',
      },
      {
        status: 'Pending',
        shortTitle: 'Budget review',
        id: 'issue-1',
        updatedAt: '2026-07-26T11:00:00.000Z',
      },
    ),
    true,
  );
});

test('actual record changes remain conflicts', () => {
  assert.equal(
    cloudPayloadsMatch(
      { id: 'issue-1', shortTitle: 'Budget review', status: 'Pending' },
      { id: 'issue-1', shortTitle: 'Budget review', status: 'Completed' },
    ),
    false,
  );
});

test('nested content is compared independently of object key order', () => {
  assert.equal(
    cloudPayloadsMatch(
      { id: 'draft-1', options: { tone: 'formal', concise: true } },
      { options: { concise: true, tone: 'formal' }, id: 'draft-1' },
    ),
    true,
  );
});
