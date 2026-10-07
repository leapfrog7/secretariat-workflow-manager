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
  assert.match(module, /lazy\(loadNotingPanel\)/);
  assert.match(module, /lazy\(loadDraftingWorkspace\)/);
  assert.match(source('src/pages/CaseworkPage.jsx'), /<CaseworkModule/);
  assert.doesNotMatch(source('src/pages/IssueWorkspacePage.jsx'), /<CaseworkModule/);
  assert.match(source('src/pages/IssueWorkspacePage.jsx'), /Open Casework/);
});

test('Casework prioritizes the selected matter and defers secondary work', () => {
  const page = source('src/pages/CaseworkPage.jsx');
  const module = source('src/features/casework/CaseworkModule.jsx');

  assert.match(page, /const navigationPromise = fetchIssueNavigation\(\)/);
  assert.match(page, /const workspacePromise = Promise\.all/);
  assert.match(page, /setBundle\(\{ \.\.\.emptyBundle, issue, accessLevel \}\)/);
  assert.match(page, /setLoading\(false\)[\s\S]*const applyWorkspace = workspacePromise\.then/);
  assert.match(page, /const applyNavigation = navigationPromise\.then/);
  assert.match(page, /Promise\.all\(\[applyWorkspace, applyNavigation\]\)/);
  assert.match(page, /workspaceLoading=\{workspaceLoading\}/);
  assert.match(page, /navigationLoading && bundle\.issue/);
  assert.match(module, /visitedViews/);
  assert.match(module, /<Suspense fallback=/);
  assert.match(module, /onPointerEnter=\{preloadDraftingWorkspace\}/);
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

test('Casework gives matter context, workflow and work modes a single sticky hierarchy', () => {
  const module = source('src/features/casework/CaseworkModule.jsx');
  assert.match(module, /sticky top-14/);
  assert.match(module, /issue\.shortTitle/);
  assert.match(module, /StatusBadge/);
  assert.match(module, /issue\.currentPosition/);
  assert.match(module, /issue\.nextDeadline/);
  assert.match(module, /OperationStatus/);
  assert.match(module, /workflowSteps\.map/);
  assert.match(module, /TabList/);
  assert.match(module, /Examine and Note/);
  assert.match(module, /Prepare Communication/);
});

test('Casework editing surfaces share a contextual command bar without duplicating record actions', () => {
  const commandBar = source('src/components/ui/ContextualCommandBar.jsx');
  const noting = source('src/features/noting/NotingPanel.jsx');
  const drafting = source('src/features/drafting/DraftingWorkspace.jsx');

  assert.match(commandBar, /role="toolbar"/);
  assert.match(commandBar, /bottom-\[var\(--app-mobile-nav-clearance\)\]/);
  assert.match(commandBar, /moreActions/);
  assert.match(noting, /<ContextualCommandBar/);
  assert.match(noting, /primaryAction=/);
  assert.match(drafting, /<ContextualCommandBar/);
  assert.match(drafting, /primaryAction=/);
});
