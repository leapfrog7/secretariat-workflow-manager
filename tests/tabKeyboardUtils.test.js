import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTabIndex } from '../src/utils/tabKeyboardUtils.js';

test('horizontal tabs wrap with left and right arrow keys', () => {
  assert.equal(nextTabIndex('ArrowRight', 0, 3), 1);
  assert.equal(nextTabIndex('ArrowRight', 2, 3), 0);
  assert.equal(nextTabIndex('ArrowLeft', 0, 3), 2);
  assert.equal(nextTabIndex('ArrowLeft', 2, 3), 1);
});

test('Home and End move directly while unrelated keys are ignored', () => {
  assert.equal(nextTabIndex('Home', 2, 4), 0);
  assert.equal(nextTabIndex('End', 0, 4), 3);
  assert.equal(nextTabIndex('Enter', 1, 4), -1);
  assert.equal(nextTabIndex('ArrowRight', 0, 0), -1);
});
