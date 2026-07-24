import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldResetLocalWorkspaceScope } from '../src/features/cloud/workspaceScopeUtils.js';

test('an unscoped browser cache is reset before the first cloud synchronization', () => {
  assert.equal(shouldResetLocalWorkspaceScope(null, 'workspace-1', 'user-1'), true);
});

test('the current user and workspace keep their scoped browser cache', () => {
  assert.equal(shouldResetLocalWorkspaceScope('workspace-1:user-1', 'workspace-1', 'user-1'), false);
});

test('changing either the user or workspace resets the shared browser cache', () => {
  assert.equal(shouldResetLocalWorkspaceScope('workspace-1:user-1', 'workspace-2', 'user-1'), true);
  assert.equal(shouldResetLocalWorkspaceScope('workspace-1:user-1', 'workspace-1', 'user-2'), true);
});
