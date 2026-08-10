import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('push subscriptions are registered through access-checked database functions', () => {
  const migration = source('db/migrations/027_web_push_deadline_notifications.sql');
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /user_id = \(SELECT auth\.user_id\(\)\)/);
  assert.match(migration, /is_active_workspace_member\(target_workspace_id\)/);
  assert.match(migration, /register_push_subscription/);
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE) ON public\.push_subscriptions TO authenticated/);
});

test('daily push delivery is restricted to deadline notifications and retries safely', () => {
  const automation = source('api/lib/dailyAutomation.js');
  assert.match(automation, /deadline_upcoming', 'deadline_due', 'deadline_overdue/);
  assert.match(automation, /public\.can_read_issue/);
  assert.match(automation, /d\.attempts < 3/);
  assert.match(automation, /\[404, 410\]/);
  assert.match(automation, /!member\.push_enabled/);
  assert.doesNotMatch(automation, /weekly_digest', 'monthly_digest'[\s\S]*sendNotification/);
});

test('the service worker displays and opens deadline push notifications', () => {
  const worker = source('public/sw.js');
  assert.match(worker, /addEventListener\('push'/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /addEventListener\('notificationclick'/);
  assert.match(worker, /openWindow/);
});

test('settings exposes explicit per-device push consent', () => {
  const component = source('src/components/notifications/PushNotificationSetting.jsx');
  assert.match(component, /Notification\.requestPermission\(\)/);
  assert.match(component, /userVisibleOnly: true/);
  assert.match(component, /role="switch"/);
  assert.match(source('src/pages/SettingsPage.jsx'), /<PushNotificationSetting \/>/);
});
