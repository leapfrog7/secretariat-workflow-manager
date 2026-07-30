import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditWorkspace, getDefaultOwningDivisionId } from '../src/utils/accessUtils.js';

const workspace = (role) => ({ id: 'workspace-1', membership: { role, status: 'active' } });
const profile = (role = 'user') => ({ role, status: 'active' });

test('workspace viewers are read-only while officers and administrators can edit', () => {
  assert.equal(canEditWorkspace(profile(), workspace('viewer')), false);
  assert.equal(canEditWorkspace(profile(), workspace('officer')), true);
  assert.equal(canEditWorkspace(profile(), workspace('workspace_admin')), true);
});

test('platform administration does not override workspace membership permissions', () => {
  assert.equal(canEditWorkspace(profile('platform_admin'), workspace('viewer')), false);
  assert.equal(canEditWorkspace(profile('platform_admin'), workspace('workspace_admin')), true);
  assert.equal(canEditWorkspace({ role: 'platform_admin' }, null), false);
});

test('missing or unknown workspace memberships fail closed', () => {
  assert.equal(canEditWorkspace(profile(), { id: 'workspace-1' }), false);
  assert.equal(canEditWorkspace(profile(), workspace(undefined)), false);
  assert.equal(canEditWorkspace(profile(), workspace('unexpected-role')), false);
  assert.equal(canEditWorkspace({ role: 'user', status: 'suspended' }, workspace('officer')), false);
});

test('a sole active division membership becomes the safe owning-division default', () => {
  const divisions = [
    { id: 'admin', is_active: true },
    { id: 'finance', is_active: true },
    { id: 'old', is_active: false },
  ];
  assert.equal(getDefaultOwningDivisionId({
    divisions,
    memberships: [
      { user_id: 'user-1', division_id: 'admin', status: 'active' },
      { user_id: 'user-1', division_id: 'old', status: 'active' },
      { user_id: 'user-2', division_id: 'finance', status: 'active' },
    ],
    userId: 'user-1',
  }), 'admin');
});

test('multiple or missing active memberships require an explicit division choice', () => {
  const divisions = [{ id: 'admin', is_active: true }, { id: 'finance', is_active: true }];
  assert.equal(getDefaultOwningDivisionId({
    divisions,
    memberships: [
      { user_id: 'user-1', division_id: 'admin', status: 'active' },
      { user_id: 'user-1', division_id: 'finance', status: 'active' },
    ],
    userId: 'user-1',
  }), '');
  assert.equal(getDefaultOwningDivisionId({ divisions, memberships: [], userId: 'user-1' }), '');
});
