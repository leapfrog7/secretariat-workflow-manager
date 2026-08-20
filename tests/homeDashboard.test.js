import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildHomeDashboard, getIssueAttentionReason } from '../src/features/dashboard/homeDashboard.js';

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isoTime(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Home summarizes only active visible work and separates focus views', () => {
  const issues = [
    { id: 'overdue', status: 'In Progress', priority: 'Normal', nextDeadline: isoDate(-1), updatedAt: isoTime(-1) },
    { id: 'today', status: 'Pending', priority: 'Normal', nextDeadline: isoDate(0), updatedAt: isoTime(-1) },
    { id: 'awaiting', status: 'Awaiting Input', priority: 'Normal', updatedAt: isoTime(-1) },
    { id: 'critical', status: 'In Progress', priority: 'Critical', updatedAt: isoTime(-1) },
    { id: 'stale', status: 'In Progress', priority: 'Normal', updatedAt: isoTime(-30) },
    { id: 'closed', status: 'Completed', priority: 'Critical', nextDeadline: isoDate(-2), updatedAt: isoTime(-1) },
    { id: 'archived', status: 'In Progress', priority: 'High', isArchived: true, updatedAt: isoTime(-1) },
  ];

  const dashboard = buildHomeDashboard(issues);
  assert.equal(dashboard.active.length, 5);
  assert.deepEqual(dashboard.pending.map((issue) => issue.id), ['today']);
  assert.deepEqual(dashboard.overdue.map((issue) => issue.id), ['overdue']);
  assert.deepEqual(dashboard.dueSoon.map((issue) => issue.id), ['today']);
  assert.deepEqual(dashboard.awaiting.map((issue) => issue.id), ['awaiting']);
  assert.deepEqual(dashboard.highPriority.map((issue) => issue.id), ['critical']);
  assert.deepEqual(dashboard.stale.map((issue) => issue.id), ['stale']);
  assert.deepEqual(dashboard.attention.slice(0, 2).map((issue) => issue.id), ['overdue', 'today']);
});

test('Home gives each attention item a concise visual reason', () => {
  assert.deepEqual(getIssueAttentionReason({ status: 'In Progress', nextDeadline: isoDate(-1) }), { label: 'Overdue', tone: 'danger' });
  assert.deepEqual(getIssueAttentionReason({ status: 'Awaiting Discussion' }), { label: 'Awaiting Discussion', tone: 'violet' });
});

test('authenticated root, route preloading and navigation lead to Home', () => {
  const routes = source('src/routes/AppRoutes.jsx');
  const preload = source('src/routes/routePreload.js');
  const sidebar = source('src/components/layout/Sidebar.jsx');
  const mobile = source('src/components/layout/MobileNavigation.jsx');

  assert.match(routes, /Navigate to="\/home"/);
  assert.match(routes, /path: 'home'/);
  assert.match(preload, /pathname === '\/home'/);
  assert.match(sidebar, /label: 'Home', to: '\/home'/);
  assert.match(mobile, /label: 'Home', to: '\/home'/);
});

test('Home provides search, attention, recent work and register focus views', () => {
  const home = source('src/pages/DashboardPage.jsx');
  const register = source('src/pages/IssueRegisterPage.jsx');

  assert.match(home, /Needs your attention/);
  assert.match(home, /Continue working/);
  assert.match(home, /Search matters and workspace/);
  assert.match(home, /Welcome to your dashboard/);
  assert.match(home, /\/issues\?focus=overdue/);
  assert.match(home, /\/issues\?focus=pending/);
  assert.match(register, /matchesFocusView/);
  assert.match(register, /aria-label="Active Issue filters"/);
  assert.match(register, />Filtered<\/span>/);
  assert.match(register, /filters\.focus/);
});

test('Home attention rows read the canonical eFile number field', () => {
  const page = readFileSync(new URL('../src/pages/DashboardPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /issue\.eFileNumber \|\| 'No eFile number'/);
  assert.doesNotMatch(page, /issue\.efileNumber/);
});
