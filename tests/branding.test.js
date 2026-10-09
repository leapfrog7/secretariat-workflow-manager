import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('SWM uses one professional workflow mark across product surfaces', async () => {
  const [favicon, mark, shell, sidebar, landing] = await Promise.all([
    readProjectFile('public/favicon.svg'),
    readProjectFile('src/components/branding/SwmMark.jsx'),
    readProjectFile('src/layouts/AppShell.jsx'),
    readProjectFile('src/components/layout/Sidebar.jsx'),
    readProjectFile('src/pages/PublicLandingPage.jsx'),
  ]);

  assert.match(favicon, /M18 19h22a6 6 0 0 1 0 12H24a6 6 0 0 0 0 12h22/);
  assert.match(mark, /export default function SwmMark/);
  assert.match(shell, /<SwmMark/);
  assert.match(sidebar, /<SwmMark/);
  assert.equal((landing.match(/<SwmMark/g) || []).length, 2);
  assert.doesNotMatch(shell, /ClipboardCheck/);
  assert.doesNotMatch(sidebar, /ClipboardCheck/);
});

test('the refreshed icon invalidates the previous PWA shell cache', async () => {
  const worker = await readProjectFile('public/sw.js');
  assert.match(worker, /swm-shell-v3/);
  assert.match(worker, /favicon\.svg/);
});
