import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Casework uses stable dirty reporters for notes and drafting', () => {
  const module = source('src/features/casework/CaseworkModule.jsx');
  assert.match(module, /const reportNotesDirty = useCallback/);
  assert.match(module, /const reportDraftingDirty = useCallback/);
  assert.match(module, /onDirtyChange=\{reportNotesDirty\}/);
  assert.match(module, /onDirtyChange=\{reportDraftingDirty\}/);
  assert.doesNotMatch(module, /onDirtyChange=\{\(dirty\) =>/);
});

test('dirty reporting separates state changes from unmount cleanup', () => {
  const hook = source('src/hooks/useDirtyStateReporter.js');
  assert.match(hook, /onDirtyChange\?\.\(dirty\)/);
  assert.match(hook, /callbackRef\.current\?\.\(false\)/);
  assert.match(hook, /useEffect\(\(\) => \(\) =>/);
  for (const path of [
    'src/features/noting/NotingPanel.jsx',
    'src/features/drafting/DraftingWorkspace.jsx',
    'src/components/issues/RunningSummaryPanel.jsx',
    'src/components/issues/ReferenceTab.jsx',
    'src/components/issues/CommunicationTab.jsx',
  ]) {
    const component = source(path);
    assert.match(component, /useDirtyStateReporter\(/);
    assert.doesNotMatch(component, /return \(\) => onDirtyChange\?\.\(false\)/);
  }
});

test('service worker clones responses before asynchronous cache access', () => {
  const worker = source('public/sw.js');
  const clone = worker.indexOf('const cacheCopy = response.ok ? response.clone() : null;');
  const open = worker.indexOf('caches.open(CACHE_NAME)', clone);
  assert.ok(clone >= 0 && open > clone);
  assert.match(worker.slice(clone, open + 220), /\.catch\(\(\) => \{\}\)/);
});
