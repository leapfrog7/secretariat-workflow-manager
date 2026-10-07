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
  const card = source('src/components/ui/Card.jsx');
  const badge = source('src/components/ui/Badge.jsx');

  for (const token of ['--swm-background', '--swm-surface', '--swm-ink', '--swm-primary', '--swm-border', '--swm-radius-md', '--swm-shadow-card']) {
    assert.match(styles, new RegExp(token));
  }
  assert.match(button, /primary/);
  assert.match(button, /secondary/);
  assert.match(button, /danger/);
  assert.match(surface, /Card/);
  assert.match(card, /default/);
  assert.match(card, /subtle/);
  assert.match(badge, /dot/);
});

test('the owned SWM component system covers core interaction patterns with Tailwind utilities', () => {
  const primitives = [
    'src/components/ui/Alert.jsx',
    'src/components/ui/Button.jsx',
    'src/components/ui/Card.jsx',
    'src/components/ui/ContextualCommandBar.jsx',
    'src/components/ui/FormControls.jsx',
    'src/components/ui/IconButton.jsx',
    'src/components/ui/OperationStatus.jsx',
    'src/components/ui/SectionHeader.jsx',
    'src/components/ui/Skeleton.jsx',
    'src/components/ui/Tabs.jsx',
  ];

  primitives.forEach((path) => {
    const component = source(path);
    assert.doesNotMatch(component, /import\s+['"][^'"]+\.css['"]/);
    assert.doesNotMatch(component, /style=\{\{/);
  });

  const exports = source('src/components/ui/index.js');
  for (const name of ['Alert', 'Button', 'Card', 'ContextualCommandBar', 'Input', 'Select', 'Textarea', 'IconButton', 'OperationStatus', 'SectionHeader', 'Skeleton', 'TabList']) {
    assert.match(exports, new RegExp(name));
  }
});

test('high-use work surfaces compose the SWM primitives instead of duplicating them', () => {
  const dashboard = source('src/pages/DashboardPage.jsx');
  const workspace = source('src/pages/IssueWorkspacePage.jsx');
  const stageDialog = source('src/components/issues/QuickStageDialog.jsx');
  const positionDialog = source('src/components/issues/QuickPositionDialog.jsx');

  assert.match(dashboard, /Card/);
  assert.match(dashboard, /SectionHeader/);
  assert.match(workspace, /buttonClassName/);
  assert.match(workspace, /TabList/);
  assert.match(workspace, /Alert/);
  assert.match(stageDialog, /<Select/);
  assert.match(stageDialog, /<Button/);
  assert.match(positionDialog, /<Textarea/);
  assert.match(positionDialog, /<IconButton/);
});

test('high-reuse feedback and dialog components consume the renovated foundation', () => {
  assert.match(source('src/components/common/EmptyState.jsx'), /Surface/);
  assert.match(source('src/components/common/ErrorState.jsx'), /Button/);
  assert.match(source('src/components/common/ConfirmDialog.jsx'), /Button/);
  assert.match(source('src/components/common/StatusBadge.jsx'), /Badge/);
  assert.match(source('src/components/common/PriorityBadge.jsx'), /Badge/);
  assert.match(source('src/components/common/ModalFrame.jsx'), /--swm-shadow-float/);
});

test('application feedback uses one semantic language across transient and persistent states', () => {
  const feedback = source('src/components/ui/feedback.js');
  const alert = source('src/components/ui/Alert.jsx');
  const operation = source('src/components/ui/OperationStatus.jsx');
  const toast = source('src/components/common/ToastProvider.jsx');
  const connectivity = source('src/components/cloud/ConnectivityBanner.jsx');
  const loading = source('src/components/common/LoadingState.jsx');
  const error = source('src/components/common/ErrorState.jsx');

  for (const tone of ['neutral', 'info', 'progress', 'success', 'warning', 'danger']) {
    assert.match(feedback, new RegExp(`${tone}:`));
  }
  assert.match(alert, /getFeedbackTone/);
  assert.match(operation, /loading:/);
  assert.match(operation, /syncing:/);
  assert.match(toast, /normalizeFeedbackTone/);
  assert.match(toast, /items\.slice\(-2\)/);
  assert.match(connectivity, /<Alert tone=/);
  assert.match(loading, /<OperationStatus state="loading"/);
  assert.match(error, /<Alert/);
});

test('frequent edit flows expose consistent save and failure feedback', () => {
  const issueForm = source('src/components/issues/IssueForm.jsx');
  const officerForm = source('src/components/officers/OfficerForm.jsx');
  const notifications = source('src/components/notifications/NotificationCenter.jsx');
  const noteConversation = source('src/features/noting/NoteAIConversation.jsx');

  assert.match(issueForm, /<OperationStatus/);
  assert.match(issueForm, /<Alert tone="danger"/);
  assert.match(issueForm, /loadingLabel="Saving…"/);
  assert.match(officerForm, /<OperationStatus/);
  assert.match(officerForm, /<Button type="submit"/);
  assert.match(notifications, /Loading notifications…/);
  assert.match(notifications, /Notifications unavailable/);
  assert.match(noteConversation, /tone="progress"/);
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
