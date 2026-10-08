import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the document deploys a restrictive content security policy', async () => {
  const html = await readProjectFile('index.html');
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'self'/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /script-src-attr 'none'/);
  assert.match(html, /worker-src 'self' blob:/);
  assert.match(html, /https:\/\/\*\.neon\.tech/);
  assert.match(html, /https:\/\/\*\.run\.app/);
});

test('the service worker caches only static same-origin assets', async () => {
  const worker = await readProjectFile('public/sw.js');
  assert.match(worker, /isStaticAssetRequest\(request, url\)/);
  assert.match(worker, /url\.pathname\.includes\('\/api\/'\)/);
  assert.match(worker, /Cache-Control/);
  assert.match(worker, /application\/json/);
  assert.doesNotMatch(worker, /const cacheCopy = response\.ok \?/);
});

test('secure sign-out offers an explicit local data purge', async () => {
  const [dialog, provider, scope] = await Promise.all([
    readProjectFile('src/components/auth/SecureSignOutDialog.jsx'),
    readProjectFile('src/features/auth/ConfiguredAuthProvider.jsx'),
    readProjectFile('src/features/cloud/localWorkspaceScope.js'),
  ]);
  assert.match(dialog, /Sign out and clear/);
  assert.match(dialog, /auth\.signOut\(\{ clearLocalData \}\)/);
  assert.match(provider, /if \(clearLocalData\) await clearLocalWorkspaceData\(\)/);
  assert.match(scope, /export async function clearLocalWorkspaceData/);
  assert.match(scope, /localStorage\.removeItem\(STORAGE_KEY\)/);
});
