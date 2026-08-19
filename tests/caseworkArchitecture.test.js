import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('standalone Casework composes the shared Noting and Drafting workflow', () => {
  const module = source('src/features/casework/CaseworkModule.jsx');
  assert.match(module, /NotingPanel/);
  assert.match(module, /DraftingWorkspace/);
  assert.match(source('src/pages/CaseworkPage.jsx'), /<CaseworkModule/);
  assert.doesNotMatch(source('src/pages/IssueWorkspacePage.jsx'), /<CaseworkModule/);
  assert.match(source('src/pages/IssueWorkspacePage.jsx'), /Open Casework/);
});

test('Casework supports an Issue picker and a stable Issue deep link', () => {
  const routes = source('src/routes/AppRoutes.jsx');
  assert.match(routes, /path: 'casework'/);
  assert.match(routes, /path: 'casework\/:issueId'/);
  assert.match(source('src/pages/CaseworkPage.jsx'), /getIssueAccessLevel/);
  assert.match(source('src/features/casework/CaseworkIssuePicker.jsx'), /searchCloudCaseworkIssues/);
  assert.match(source('db/migrations/025_casework_scale_and_telemetry.sql'), /public\.can_read_issue/);
  assert.doesNotMatch(source('db/migrations/025_casework_scale_and_telemetry.sql'), /prompt|generated_text|payload\s+jsonb/i);
});

test('Casework aligns its primary action with the Issue search control', () => {
  const page = source('src/pages/CaseworkPage.jsx');
  assert.match(page, /New Issue/);
  assert.match(page, /aria-label="Create new Issue"/);
  assert.match(page, /min-h-10 shrink-0/);
  assert.match(page, /h-11 w-full items-center justify-center rounded-md bg-teal-700/);
});

test('Casework gives the active matter and its workflow a single visual hierarchy', () => {
  const module = source('src/features/casework/CaseworkModule.jsx');
  assert.match(module, /Active matter/);
  assert.match(module, /issue\.currentPosition/);
  assert.match(module, /workflowSteps\.map/);
  assert.match(module, /Examine and Note/);
  assert.match(module, /Prepare Communication/);
  assert.match(module, /rounded-xl border-slate-200/);
});
