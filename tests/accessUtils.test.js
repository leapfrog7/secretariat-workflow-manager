import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditWorkspace } from '../src/utils/accessUtils.js';

const workspace = (role) => ({ id: 'workspace-1', membership: { role } });

test('workspace viewers are read-only while officers and administrators can edit', () => {
  assert.equal(canEditWorkspace({ role: 'user' }, workspace('viewer')), false);
  assert.equal(canEditWorkspace({ role: 'user' }, workspace('officer')), true);
  assert.equal(canEditWorkspace({ role: 'user' }, workspace('workspace_admin')), true);
});

test('platform administrators retain edit access and missing workspaces do not', () => {
  assert.equal(canEditWorkspace({ role: 'platform_admin' }, workspace('viewer')), true);
  assert.equal(canEditWorkspace({ role: 'platform_admin' }, null), false);
});
