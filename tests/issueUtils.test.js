import assert from 'node:assert/strict';
import test from 'node:test';
import { getIssuePositionPreview } from '../src/utils/issueUtils.js';

test('present-position preview is concise and adds an ellipsis only when truncated', () => {
  const longPosition = 'Comments received from the subordinate office are under examination and the revised proposal will be submitted for approval after consultation';
  assert.equal(
    getIssuePositionPreview(longPosition),
    'Comments received from the subordinate office are under examination and the revised proposal will be submitted for approval…',
  );
  assert.equal(getIssuePositionPreview('Awaiting comments from Finance Division.'), 'Awaiting comments from Finance Division.');
  assert.equal(getIssuePositionPreview('   '), '');
});
