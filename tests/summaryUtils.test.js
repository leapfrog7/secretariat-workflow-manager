import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIssueSummary, summariesMatch, validateIssueSummary } from '../src/utils/summaryUtils.js';

test('legacy structured summaries become one readable Markdown note', () => {
  const summary = normalizeIssueSummary({
    overview: 'Procurement proposal under examination.',
    presentPosition: 'Finance comments are awaited.',
    nextStep: 'Issue a reminder on 31 July.',
  });

  assert.match(summary.content, /## What this Issue is about\nProcurement proposal/);
  assert.match(summary.content, /## Present position\nFinance comments are awaited/);
  assert.match(summary.content, /## Immediate next step\nIssue a reminder/);
});

test('new running summaries validate and compare by their single content field', () => {
  const first = normalizeIssueSummary({ content: 'Decision recorded on 23 July.' });
  const same = normalizeIssueSummary({ content: 'Decision recorded on 23 July.' });
  const changed = normalizeIssueSummary({ content: 'Decision recorded on 24 July.' });

  assert.deepEqual(validateIssueSummary(first), {});
  assert.equal(summariesMatch(first, same), true);
  assert.equal(summariesMatch(first, changed), false);
  assert.ok(validateIssueSummary(normalizeIssueSummary()).summary);
});
