import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePositionUpdate } from '../src/utils/positionUpdateUtils.js';

test('a new position entry becomes the latest position and milestone note', () => {
  const result = resolvePositionUpdate(
    { currentPosition: 'Earlier recorded position' },
    { positionNote: '  Fresh update for the file  ', currentPosition: '' },
  );

  assert.deepEqual(result, {
    currentPosition: 'Fresh update for the file',
    milestoneNote: 'Fresh update for the file',
    hasPositionNote: true,
  });
});

test('an empty entry preserves the latest stored position without repeating it', () => {
  const result = resolvePositionUpdate(
    { currentPosition: 'Earlier recorded position' },
    { positionNote: '', currentPosition: '' },
  );

  assert.deepEqual(result, {
    currentPosition: 'Earlier recorded position',
    milestoneNote: '',
    hasPositionNote: false,
  });
});

test('ordinary Issue edits retain the existing current-position behavior', () => {
  const result = resolvePositionUpdate(
    { currentPosition: 'Earlier recorded position' },
    { currentPosition: 'Updated through Issue details' },
  );

  assert.deepEqual(result, {
    currentPosition: 'Updated through Issue details',
    milestoneNote: 'Updated through Issue details',
    hasPositionNote: true,
  });
});
