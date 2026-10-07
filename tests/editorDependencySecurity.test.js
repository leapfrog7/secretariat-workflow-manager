import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mergeAttributes } from '@tiptap/core';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

function versionAtLeast(version, minimum) {
  const current = version.split('.').map(Number);
  const required = minimum.split('.').map(Number);
  for (let index = 0; index < required.length; index += 1) {
    if (current[index] > required[index]) return true;
    if (current[index] < required[index]) return false;
  }
  return true;
}

test('rich-editor dependencies stay on one patched Tiptap release', () => {
  const directTiptapPackages = Object.entries(packageJson.dependencies)
    .filter(([name]) => name.startsWith('@tiptap/'));

  assert.ok(directTiptapPackages.length > 0);
  for (const [name, version] of directTiptapPackages) {
    assert.equal(version, '3.31.4', `${name} must remain aligned with the patched editor release`);
  }

  const installedTiptapPackages = Object.entries(lockfile.packages)
    .filter(([path]) => path.startsWith('node_modules/@tiptap/'));

  assert.ok(installedTiptapPackages.length > 0);
  for (const [path, metadata] of installedTiptapPackages) {
    assert.ok(
      versionAtLeast(metadata.version, '3.30.5'),
      `${path} ${metadata.version} reintroduces a known Tiptap security advisory`,
    );
  }
});

test('ProseMirror paste handling uses the XSS-patched release', () => {
  assert.equal(packageJson.dependencies['prosemirror-view'], '1.42.6');
  const installed = lockfile.packages['node_modules/prosemirror-view'];
  assert.ok(installed);
  assert.ok(versionAtLeast(installed.version, '1.42.3'));
});

test('Tiptap does not turn an own __proto__ value into executable inherited attributes', () => {
  const untrusted = { class: 'safe' };
  Object.defineProperty(untrusted, '__proto__', {
    value: { onclick: 'alert(1)' },
    enumerable: true,
  });

  const merged = mergeAttributes(untrusted);
  assert.equal(merged.onclick, undefined);
  assert.equal(Object.getPrototypeOf(merged), Object.prototype);
  assert.equal(merged.class, 'safe');
});
