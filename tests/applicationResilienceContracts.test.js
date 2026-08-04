import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('the application has both global and route-level recovery screens', () => {
  assert.match(source('src/main.jsx'), /AppErrorBoundary/);
  assert.match(source('src/routes/AppRoutes.jsx'), /errorElement:\s*<RouteErrorPage/);
  assert.match(source('src/components/common/AppErrorBoundary.jsx'), /locally saved workspace data has not been removed/i);
});

test('the application shell supports skip navigation and offline reassurance', () => {
  const shell = source('src/layouts/AppShell.jsx');
  assert.match(shell, /href="#main-content"/);
  assert.match(shell, /id="main-content"/);
  assert.match(shell, /ConnectivityBanner/);
  assert.match(source('src/components/cloud/ConnectivityBanner.jsx'), /Working offline/);
});

test('principal tab-heavy pages use the shared keyboard behavior', () => {
  for (const path of [
    'src/pages/IssueWorkspacePage.jsx',
    'src/pages/SettingsPage.jsx',
    'src/pages/AdminPage.jsx',
    'src/features/drafting/DraftingWorkspace.jsx',
  ]) {
    assert.match(source(path), /handleTabListKeyDown/);
  }
});
