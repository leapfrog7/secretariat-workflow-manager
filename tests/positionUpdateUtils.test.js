import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findCurrentPositionMilestone,
  positionRecordedAt,
  resolvePositionUpdate,
} from '../src/utils/positionUpdateUtils.js';

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

test('a selected update date retains the current local time', () => {
  const now = new Date(2026, 6, 31, 14, 25, 12);
  const result = positionRecordedAt('2026-07-29', now);
  const recorded = new Date(result);

  assert.equal(recorded.getFullYear(), 2026);
  assert.equal(recorded.getMonth(), 6);
  assert.equal(recorded.getDate(), 29);
  assert.equal(recorded.getHours(), 14);
  assert.equal(recorded.getMinutes(), 25);
  assert.equal(recorded.getSeconds(), 12);
});

test('correction targets the milestone that supplies the displayed position', () => {
  const result = findCurrentPositionMilestone(
    [
      {
        id: 'stage-only',
        note: '',
        recordedAt: '2026-07-31T09:00:00.000Z',
      },
      {
        id: 'current-position',
        note: 'Comments are under examination.',
        recordedAt: '2026-07-30T09:00:00.000Z',
      },
      {
        id: 'older-position',
        note: 'Comments were requested.',
        recordedAt: '2026-07-20T09:00:00.000Z',
      },
    ],
    'Comments are under examination.',
  );

  assert.equal(result.id, 'current-position');
});

test('correction is unavailable when the displayed text has no matching milestone', () => {
  assert.equal(
    findCurrentPositionMilestone(
      [{ id: 'older', note: 'Earlier wording', recordedAt: '2026-07-20' }],
      'Different current wording',
    ),
    null,
  );
});
