import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGeneratedWorkingCopy,
  createSavedWorkingCopy,
  EMPTY_DRAFT_WORKING_COPY,
  hasUnsavedWorkingCopy,
  markWorkingCopyChanged,
} from '../src/features/drafting/domain/draftWorkingCopy.js';

test('a generated draft starts as an unsaved working copy', () => {
  const workingCopy = createGeneratedWorkingCopy();

  assert.equal(workingCopy.mode, 'working');
  assert.equal(workingCopy.dirty, true);
  assert.equal(hasUnsavedWorkingCopy(workingCopy), true);
});

test('a saved draft opens as a clean editable working copy', () => {
  const workingCopy = createSavedWorkingCopy({ id: 'draft-4', version: 4 });

  assert.deepEqual(workingCopy, {
    mode: 'working',
    baseDraftId: 'draft-4',
    baseVersion: 4,
    dirty: false,
    configurationDirty: false,
  });
  assert.equal(hasUnsavedWorkingCopy(workingCopy), false);
});

test('content and setup changes are tracked independently', () => {
  const workingCopy = createSavedWorkingCopy({ id: 'draft-2', version: 2 });
  const contentChanged = markWorkingCopyChanged(workingCopy);
  const setupChanged = markWorkingCopyChanged(contentChanged, { configuration: true });

  assert.equal(contentChanged.dirty, true);
  assert.equal(contentChanged.configurationDirty, false);
  assert.equal(setupChanged.dirty, true);
  assert.equal(setupChanged.configurationDirty, true);
  assert.equal(hasUnsavedWorkingCopy(setupChanged), true);
});

test('empty state cannot be marked as a working change', () => {
  assert.equal(markWorkingCopyChanged(EMPTY_DRAFT_WORKING_COPY), EMPTY_DRAFT_WORKING_COPY);
});
