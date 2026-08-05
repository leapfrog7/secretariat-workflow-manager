import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('mobile content clearance includes navigation height and device safe area', () => {
  const css = source('src/index.css');
  assert.match(css, /--app-mobile-nav-clearance:/);
  assert.match(css, /env\(safe-area-inset-bottom(?:,\s*0px)?\)/);
  assert.match(css, /\.app-main[\s\S]*padding-bottom:\s*var\(--app-mobile-nav-clearance\)/);
});

test('high-use workflow dialogs use the shared mobile-safe modal', () => {
  for (const path of [
    'src/features/noting/NotingPanel.jsx',
    'src/features/noting/pdf/PdfContextDialog.jsx',
    'src/features/drafting/DraftingWorkspace.jsx',
    'src/pages/AdminPage.jsx',
  ]) {
    assert.match(source(path), /ModalFrame/);
  }
  assert.match(source('src/components/common/ModalFrame.jsx'), /mobile-sheet-safe/);
  assert.match(source('src/components/common/ModalFrame.jsx'), /max-h-\[96dvh\]/);
});

test('mobile navigation keeps the five primary destinations in the intended order', () => {
  const navigation = source('src/components/layout/MobileNavigation.jsx');
  const issues = navigation.indexOf("label: 'Issues'");
  const casework = navigation.indexOf("label: 'Casework'");
  const create = navigation.indexOf("label: 'Create Issue'");
  const reports = navigation.indexOf("label: 'Reports'");
  assert.ok(issues >= 0 && issues < casework && casework < create && create < reports);
  assert.match(navigation, /<span>More<\/span>/);
});
