import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('SWM exposes a coherent token foundation and owned interface primitives', () => {
  const styles = source('src/index.css');
  const button = source('src/components/ui/Button.jsx');
  const surface = source('src/components/ui/Surface.jsx');
  const badge = source('src/components/ui/Badge.jsx');

  for (const token of ['--swm-background', '--swm-surface', '--swm-ink', '--swm-primary', '--swm-border', '--swm-radius-md', '--swm-shadow-card']) {
    assert.match(styles, new RegExp(token));
  }
  assert.match(button, /primary/);
  assert.match(button, /secondary/);
  assert.match(button, /danger/);
  assert.match(surface, /default/);
  assert.match(surface, /subtle/);
  assert.match(badge, /dot/);
});

test('high-reuse feedback and dialog components consume the renovated foundation', () => {
  assert.match(source('src/components/common/EmptyState.jsx'), /Surface/);
  assert.match(source('src/components/common/ErrorState.jsx'), /Button/);
  assert.match(source('src/components/common/ConfirmDialog.jsx'), /Button/);
  assert.match(source('src/components/common/StatusBadge.jsx'), /Badge/);
  assert.match(source('src/components/common/PriorityBadge.jsx'), /Badge/);
  assert.match(source('src/components/common/ModalFrame.jsx'), /--swm-shadow-float/);
});

test('primary work surfaces use the consolidated page hierarchy', () => {
  const pages = [
    ['src/pages/IssueRegisterPage.jsx', 'Work register'],
    ['src/pages/CaseworkPage.jsx', 'Examine and act'],
    ['src/pages/ReportsPage.jsx', 'Operational intelligence'],
    ['src/pages/ReferencesPage.jsx', 'Shared knowledge'],
    ['src/pages/SettingsPage.jsx', 'Your workspace'],
    ['src/pages/AdminPage.jsx', 'Workspace governance'],
  ];

  pages.forEach(([path, eyebrow]) => assert.match(source(path), new RegExp(`eyebrow=["']${eyebrow}["']`)));
});

test('desktop and mobile navigation share the renovated shell tokens', () => {
  assert.match(source('src/layouts/AppShell.jsx'), /--swm-background/);
  assert.match(source('src/components/layout/Sidebar.jsx'), /--swm-ink/);
  assert.match(source('src/components/layout/MobileNavigation.jsx'), /--swm-shadow-float/);
});

test('native selects use the shared modern control treatment', () => {
  const styles = source('src/index.css');
  assert.match(styles, /select:not\(\[multiple\]\)[\s\S]*appearance:\s*none/);
  assert.match(styles, /background-position:\s*right 0\.75rem center/);
  assert.match(styles, /padding-right:\s*2\.5rem/);
  assert.match(source('src/features/casework/CaseworkIssuePicker.jsx'), /ChevronDown/);
});

test('shared motion and loading states follow the renovated feedback system', () => {
  const styles = source('src/index.css');
  const loading = source('src/components/common/LoadingState.jsx');

  for (const token of ['--swm-motion-fast', '--swm-motion-standard', '--swm-motion-emphasized', '--swm-ease-out']) {
    assert.match(styles, new RegExp(token));
  }
  assert.match(styles, /\.popover-enter/);
  assert.match(styles, /\.disclosure-enter/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(loading, /function DashboardSkeleton/);
  assert.match(loading, /function RegisterSkeleton/);
  assert.match(loading, /function CaseworkSkeleton/);
  assert.match(loading, /function SettingsSkeleton/);
  assert.match(loading, /data-loading-variant/);
});
