import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDraft, planDraftStorage } from '../src/utils/draftUtils.js';

test('legacy saved drafts normalize as immutable version-one snapshots', () => {
  const draft = normalizeDraft({
    id: 'legacy-draft',
    issueId: 'issue-1',
    version: 2,
    content: 'Legacy draft text',
    createdAt: '2026-07-01T00:00:00.000Z',
  });

  assert.equal(draft.immutableSnapshot, true);
  assert.equal(draft.snapshotSchemaVersion, 1);
  assert.equal(draft.savedAt, '2026-07-01T00:00:00.000Z');
});

test('draft storage advances monotonically and retires the oldest snapshot', () => {
  const drafts = [1, 2, 3, 4, 5].map((version) => ({
    id: `draft-${version}`,
    issueId: 'issue-1',
    version,
    content: `Version ${version}`,
  }));

  const plan = planDraftStorage(drafts, 5);

  assert.equal(plan.nextVersion, 6);
  assert.equal(plan.overwrite.id, 'draft-1');
  assert.deepEqual(plan.deletedIds, []);
});

test('draft storage also cleans surplus snapshots left by an older client', () => {
  const drafts = [1, 2, 3, 4, 5, 6, 7].map((version) => ({
    id: `draft-${version}`,
    issueId: 'issue-1',
    version,
    content: `Version ${version}`,
  }));

  const plan = planDraftStorage(drafts, 5);

  assert.equal(plan.nextVersion, 8);
  assert.equal(plan.overwrite.id, 'draft-1');
  assert.deepEqual(plan.deletedIds, ['draft-2', 'draft-3']);
});
