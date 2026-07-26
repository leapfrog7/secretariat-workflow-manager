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

test('officer identity ignores mutable directory metadata from another device', () => {
  const minimal = {
    name: 'Yatin Kumar',
    designation: 'Section Officer',
    section: '',
    role: 'Other',
    isActive: true,
  };
  const enriched = {
    name: 'Yatin Kumar',
    designation: 'Section Officer',
    section: 'Administration',
    role: 'Section Officer',
    telephone: '12345',
    isActive: false,
  };

  assert.equal(getOfficerIdentityKey(minimal), getOfficerIdentityKey(enriched));
});

test('officer identity preserves entries with a different name or designation', () => {
  const officer = { name: 'Yatin Kumar', designation: 'Section Officer' };
  const differentPost = { name: 'Yatin Kumar', designation: 'Under Secretary' };
  const differentName = { name: 'Sethi', designation: 'Section Officer' };

  assert.notEqual(getOfficerIdentityKey(officer), getOfficerIdentityKey(differentPost));
  assert.notEqual(getOfficerIdentityKey(officer), getOfficerIdentityKey(differentName));
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
