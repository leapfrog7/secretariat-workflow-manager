import test from 'node:test';
import assert from 'node:assert/strict';
import { filterIssueCommands, filterWorkspaceCommands, getWorkspaceCommands } from '../src/features/navigation/commandModel.js';

test('workspace commands respect editing and administration permissions', () => {
  const viewer = getWorkspaceCommands();
  assert.equal(viewer.some((item) => item.id === 'new-issue'), false);
  assert.equal(viewer.some((item) => item.id === 'admin'), false);
  const administrator = getWorkspaceCommands({ canEdit: true, isWorkspaceAdmin: true });
  assert.equal(administrator[0].id, 'new-issue');
  assert.equal(administrator.at(-1).id, 'admin');
});

test('workspace command matching includes descriptions', () => {
  const commands = getWorkspaceCommands();
  assert.deepEqual(filterWorkspaceCommands(commands, 'noting').map((item) => item.id), ['casework']);
});

test('Issue commands search useful fields and omit inactive records', () => {
  const issues = [
    { id: '1', shortTitle: 'Court matter', eFileNumber: '123', updatedAt: '2026-08-18' },
    { id: '2', shortTitle: 'Appointment', currentPosition: 'Awaiting approval', updatedAt: '2026-08-19' },
    { id: '3', shortTitle: 'Archived court matter', isArchived: true, updatedAt: '2026-08-20' },
  ];
  assert.deepEqual(filterIssueCommands(issues, 'court').map((item) => item.id), ['1']);
  assert.deepEqual(filterIssueCommands(issues, 'approval').map((item) => item.id), ['2']);
});
