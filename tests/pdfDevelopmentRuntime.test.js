import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('development does not let the production service worker intercept Vite modules', () => {
  const main = source('src/main.jsx');
  assert.match(main, /import\.meta\.env\.PROD && 'serviceWorker' in navigator/);
  assert.match(main, /import\.meta\.env\.DEV && 'serviceWorker' in navigator/);
  assert.match(main, /registration\.unregister\(\)/);
  assert.match(main, /key\.startsWith\('swm-shell-'\)/);
});

test('PDF.js remains lazy but bypasses Vite dependency prebundling', () => {
  assert.match(source('vite.config.js'), /exclude: \['pdfjs-dist'\]/);
  assert.match(source('src/features/noting/pdf/pdfExtractionService.js'), /import\('pdfjs-dist\/build\/pdf\.mjs'\)/);
});

test('mobile note AI actions share one row', () => {
  const noting = source('src/features/noting/NotingPanel.jsx');
  assert.match(noting, /grid w-full grid-cols-2 gap-2 sm:flex/);
  assert.match(noting, /relative inline-flex min-w-0/);
  assert.match(noting, /text-\[11px\][\s\S]*sm:text-xs/);
});
