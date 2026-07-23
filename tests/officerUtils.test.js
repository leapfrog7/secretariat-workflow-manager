import test from 'node:test';
import assert from 'node:assert/strict';
import { getOfficerIdentityKey } from '../src/utils/officerIdentity.js';
import { normalizeMilestone } from '../src/utils/milestoneUtils.js';

test('officer identity ignores harmless case and whitespace differences', () => {
  const first = {
    id: 'one',
    name: '  Yatin   Kumar ',
    designation: 'Section Officer',
    email: 'YATIN@example.com',
    role: 'Other',
  };
  const second = {
    id: 'two',
    name: 'yatin kumar',
    designation: ' section officer ',
    email: 'yatin@EXAMPLE.COM',
    role: 'Other',
  };

  assert.equal(getOfficerIdentityKey(first), getOfficerIdentityKey(second));
});

test('officer identity preserves materially different directory entries', () => {
  const active = { name: 'Yatin Kumar', designation: 'Section Officer', role: 'Other', isActive: true };
  const inactive = { name: 'Yatin Kumar', designation: 'Section Officer', role: 'Other', isActive: false };
  const differentPost = { name: 'Yatin Kumar', designation: 'Under Secretary', role: 'Other', isActive: true };

  assert.notEqual(getOfficerIdentityKey(active), getOfficerIdentityKey(inactive));
  assert.notEqual(getOfficerIdentityKey(active), getOfficerIdentityKey(differentPost));
});

test('milestones retain a synchronization timestamp when remapped', () => {
  const milestone = normalizeMilestone({
    id: 'milestone',
    issueId: 'issue',
    recordedAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  });

  assert.equal(milestone.updatedAt, '2026-07-23T00:00:00.000Z');
});
